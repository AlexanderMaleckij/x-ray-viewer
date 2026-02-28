using SkiaSharp;
using System.Runtime.InteropServices;
using XRay.Metadata;

namespace XRay;

/// <summary>
/// Converts proprietary.STL X-ray files to PNG,
/// and extracts metadata strings from the header (CP1251 encoded).<br/>
/// <br/>
/// Format details (reverse-engineered):<br/>
///   - Bytes 0-1  : uint16 LE — logical image width  (e.g. 1495, informational only)<br/>
///   - Bytes 2-3  : uint16 LE — image height in pixels (e.g. 1455) == StoredCols<br/>
///   - Bytes 4-1336: header metadata — null-terminated CP1251 strings at known offsets<br/>
///   - Bytes 1337+: 16-bit little-endian pixel data, stored columns-first (transposed)<br/>
///                  StoredRows = (fileSize - 1337) / (StoredCols * 2)<br/>
///<br/>
/// Known header string fields:<br/>
///   Offset  14 (0x00E) : Exposure        e.g. "75kV; 40mA"<br/>
///   Offset  44 (0x02C) : Institution     e.g. "ГУЗ ГГП №1"<br/>
///   Offset  94 (0x05E) : DeviceModel     e.g. "PP210"<br/>
///   Offset 114 (0x072) : PatientName     e.g. "ИВАНОВ ИВАН ИВАНОВИЧ"<br/>
///   Offset 194 (0x0C2) : VisitType       e.g. "АМБУЛАТОРНО"<br/>
///   Offset 214 (0x0D6) : Address         e.g. "ЗАЙЦЕВА 11/11"<br/>
///   Offset 264 (0x108) : BirthDate       e.g. "29111970"<br/>
///   Offset 272 (0x110) : ExposureDate    e.g. "20022026"<br/>
///   Offset 280 (0x118) : Projection      e.g. "ПЕРЕДНЕЗАДНЯЯ"<br/>
///   Offset 300 (0x12C) : Radiologist     e.g. "ПЕТРОВА И Н"<br/>
///   Offset 350 (0x15E) : Gender          e.g. "жен" / "муж"<br/>
///   Offset 483 (0x1E3) : FileID          e.g. "00152440"<br/>
///   Offset 513 (0x201) : Date            e.g. "23022026"<br/>
/// <br/>
/// Image pipeline:<br/>
///   1. Read StoredCols (= header height) and derive StoredRows from file size<br/>
///   2. Read raw 16-bit pixels  [StoredRows x StoredCols]<br/>
///   3. Auto-detect column-roll seam and unroll<br/>
///   4. Percentile contrast stretch<br/>
///   5. Transpose + flip horizontally → final image [StoredRows wide x StoredCols tall]<br/>
///      with L / R marker in the bottom-right corner<br/>
/// </summary>
/// <remarks>
/// <b>This class is not thread-safe</b>. The caller should create a new instance for each file, and dispose it when done to release resources.<br/>
/// </remarks>
public sealed class XRayFileReader : IDisposable
{
    private const int HeaderSize = 1337;

    private static readonly MetadataField[] s_defaultMetadataFields =
    [
        new MetadataField(MetadataFieldId.TubeConfig,       014, 40 - 14),
        new MetadataField(MetadataFieldId.Institution,      044, 94 - 44),
        new MetadataField(MetadataFieldId.Unknown1,         094, 114 - 94),
        new MetadataField(MetadataFieldId.PatientName,      114, 194 - 114),
        new MetadataField(MetadataFieldId.CareType,         194, 214 - 194),
        new MetadataField(MetadataFieldId.PatientAddress,   214, 264 - 214),
        new DateMetadataField(MetadataFieldId.BirthDate,    264),
        new DateMetadataField(MetadataFieldId.ExposureDate, 272),
        new MetadataField(MetadataFieldId.Projection,       280, 300 - 280),
        new MetadataField(MetadataFieldId.Radiologist,      300, 350 - 300),
        new MetadataField(MetadataFieldId.Sex,              350, 483 - 350),
        new MetadataField(MetadataFieldId.FileID,           483, 513 - 483),
        new DateMetadataField(MetadataFieldId.Date,         513)
    ];

    private bool _disposed;
    private readonly Stream _stream;
    private readonly bool _ownsStream;

    public XRayFileReader(Stream stream, bool ownsStream = true)
    {
        ArgumentNullException.ThrowIfNull(stream);

        if (!stream.CanRead || !stream.CanSeek)
            throw new ArgumentException("Stream must be readable and seekable.", nameof(stream));

        if (stream.Length < HeaderSize + 4)
            throw new ArgumentException("Stream is too small to contain a valid header.", nameof(stream));

        _stream = stream;
        _ownsStream = ownsStream;
    }

    public XRayFileReader(string filePath)
    {
        ArgumentNullException.ThrowIfNull(filePath);

        if (!filePath.EndsWith(".stl", StringComparison.OrdinalIgnoreCase))
            throw new ArgumentException("Unsupported file format. Only .stl files are supported.", nameof(filePath));

        if (!File.Exists(filePath))
            throw new FileNotFoundException("The specified file was not found.", filePath);

        _stream = new FileStream(filePath, FileMode.Open, FileAccess.Read, FileShare.Read, bufferSize: 81920, useAsync: false);
        _ownsStream = true;
    }

    public MetadataFieldValue[] ExtractMetadata(MetadataField[]? metadataFields = null)
    {
        ObjectDisposedException.ThrowIf(_disposed, this);

        // Only read the header slice needed for metadata.
        Span<byte> header = stackalloc byte[HeaderSize];
        _stream.Seek(0, SeekOrigin.Begin);
        _stream.ReadExactly(header);

        var metadataReader = new MetadataFieldReader(header.ToArray());
        return [.. (metadataFields ?? s_defaultMetadataFields).Select(metadataReader.Read)];
    }

    public byte[] GetPngBuffer()
    {
        ObjectDisposedException.ThrowIf(_disposed, this);

        _stream.Seek(0, SeekOrigin.Begin);
        return ConvertBytes(_stream);
    }

    /// <summary>
    /// Core conversion logic. Reads from a seekable stream and returns PNG bytes.
    /// This method is WASM-friendly — no file I/O, no platform-native dependencies.
    /// </summary>
    private static byte[] ConvertBytes(Stream stream)
    {
        long fileLength = stream.Length;

        if (fileLength < HeaderSize + 4)
            throw new InvalidDataException("File is too small to contain a valid header.");

        // --- 1. Read dimensions from header ---
        //   Bytes 0-1: logical width  (informational only; actual stored rows may differ)
        //   Bytes 2-3: image height   (= StoredCols, the column count in stored layout)
        Span<byte> header = stackalloc byte[4];
        stream.ReadExactly(header);

        int logicalWidth = BitConverter.ToUInt16(header);
        int storedCols = BitConverter.ToUInt16(header[2..]);

        long dataBytes = fileLength - HeaderSize;
        int storedRows = (int)(dataBytes / (storedCols * 2)); // == image width after transpose
        int imageWidth = storedRows;
        int imageHeight = storedCols;

        Console.WriteLine($"Header  — logical width: {logicalWidth}, height: {storedCols}");
        Console.WriteLine($"Derived — stored layout: {storedRows} rows x {storedCols} cols");
        Console.WriteLine($"Output  — image size:    {imageWidth} x {imageHeight} px");

        long expectedBytes = HeaderSize + (long)storedRows * storedCols * 2;
        if (fileLength < expectedBytes)
            throw new InvalidDataException(
                $"File too small. Expected at least {expectedBytes} bytes, got {fileLength}.");

        // --- 2. Read raw 16-bit pixels (little-endian) ---
        //   Skip the remainder of the header (we've only read 4 bytes so far).
        stream.Seek(HeaderSize, SeekOrigin.Begin);

        int pixelCount = storedRows * storedCols;
        ushort[] raw = new ushort[pixelCount];
        Span<byte> rawBytes = MemoryMarshal.AsBytes(raw.AsSpan());
        stream.ReadExactly(rawBytes);

        // --- 3. Auto-detect and fix the column roll ---
        int seamCol = FindRollSeam(raw, storedRows, storedCols);
        Console.WriteLine($"Detected roll seam at column {seamCol} (of {storedCols}).");

        if (seamCol > 0)
            raw = RollColumns(raw, storedRows, storedCols, seamCol);

        // --- 4. Stretch contrast using 0.5th-99.5th percentile ---
        (ushort lo, ushort hi) = Percentile(raw, 0.005f, 0.995f);
        float scale = hi > lo ? 255f / (hi - lo) : 1f;

        // --- 5. Build 8-bit grayscale pixel buffer ---
        //    Transpose (columns-first -> rows-first) and flip horizontally.
        byte[] pixels = new byte[imageWidth * imageHeight];

        for (int y = 0; y < imageHeight; y++)
        {
            for (int x = 0; x < imageWidth; x++)
            {
                int srcX = imageWidth - 1 - x;
                ushort val = raw[srcX * storedCols + y];
                int stretched = (int)((val - lo) * scale);
                pixels[y * imageWidth + x] = (byte)Math.Clamp(stretched, 0, 255);
            }
        }

        // --- 6. Encode to PNG using SkiaSharp ---
        var imageInfo = new SKImageInfo(imageWidth, imageHeight, SKColorType.Gray8, SKAlphaType.Opaque);

        using var bitmap = new SKBitmap(imageInfo);
        Marshal.Copy(pixels, 0, bitmap.GetPixels(), pixels.Length);

        using SKImage image = SKImage.FromBitmap(bitmap);
        using SKData data = image.Encode(SKEncodedImageFormat.Png, quality: 100);

        return data.ToArray();
    }

    /// <summary>
    /// Finds the column index C such that the boundary between column C and C+1
    /// has the largest average absolute difference in pixel values across all rows.
    /// The outer 5% of columns on each side are excluded to avoid confusing the
    /// natural black background border with the seam.
    /// </summary>
    private static int FindRollSeam(ushort[] raw, int rows, int cols)
    {
        int margin = cols / 20;
        int bestCol = 0;
        double bestDiff = -1;

        for (int c = margin; c < cols - margin - 1; c++)
        {
            double sum = 0;
            for (int r = 0; r < rows; r++)
            {
                int a = raw[r * cols + c];
                int b = raw[r * cols + c + 1];
                sum += Math.Abs(a - b);
            }
            double avg = sum / rows;

            if (avg > bestDiff)
            {
                bestDiff = avg;
                bestCol = c + 1;
            }
        }

        return bestCol;
    }

    /// <summary>
    /// Rotates the column axis of the raw buffer left by <paramref name="seamCol"/> columns.
    /// </summary>
    private static ushort[] RollColumns(ushort[] raw, int rows, int cols, int seamCol)
    {
        ushort[] result = new ushort[raw.Length];
        int rightLen = cols - seamCol;

        for (int r = 0; r < rows; r++)
        {
            int srcBase = r * cols;
            int dstBase = r * cols;

            Array.Copy(raw, srcBase + seamCol, result, dstBase, rightLen);
            Array.Copy(raw, srcBase, result, dstBase + rightLen, seamCol);
        }

        return result;
    }

    /// <summary>Returns the pixel values at the given lower and upper percentiles.</summary>
    private static (ushort lo, ushort hi) Percentile(ushort[] data, float lowerFrac, float upperFrac)
    {
        ushort[] sorted = (ushort[])data.Clone();
        Array.Sort(sorted);
        int loIdx = (int)(lowerFrac * (sorted.Length - 1));
        int hiIdx = (int)(upperFrac * (sorted.Length - 1));
        return (sorted[loIdx], sorted[hiIdx]);
    }

    public void Dispose()
    {
        if (_disposed)
            return;

        if (_ownsStream)
            _stream.Dispose();

        _disposed = true;
    }
}
