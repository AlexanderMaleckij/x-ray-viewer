using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Runtime.InteropServices.JavaScript;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using XRay;
using XRay.Metadata;

sealed partial class XRayFileReaderWrapper : IDisposable
{
    [JsonSerializable(typeof(Dictionary<MetadataFieldId, string>))]
    private sealed partial class MetadataJsonContext : JsonSerializerContext
    {
        private static readonly JsonSerializerContext _metadataJsonContext = new MetadataJsonContext(
            new JsonSerializerOptions
            {
                PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
                DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull
            });

        public static JsonSerializerContext Custom => _metadataJsonContext;
    }

    private static XRayFileReader _reader = null;

    static XRayFileReaderWrapper()
    {
        Encoding.RegisterProvider(CodePagesEncodingProvider.Instance);
    }

    public static void Main()
    { 
    }

    [JSExport]
    internal static void Open(byte[] file)
    {
        _reader?.Dispose();
        var stream = new MemoryStream(file);
        _reader = new XRayFileReader(stream, ownsStream: true);
    }

    [JSExport]
    internal static string GetImageSrc()
    {
        ArgumentNullException.ThrowIfNull(_reader);

        return $"data:image/png;base64,{Convert.ToBase64String(_reader.GetPngBuffer())}";
    }

    [JSExport]
    internal static string GetMetadata()
    {
        ArgumentNullException.ThrowIfNull(_reader);

        var metadata = _reader.ExtractMetadata();
        var result = new Dictionary<MetadataFieldId, string>(
            metadata.Select(x => new KeyValuePair<MetadataFieldId, string>(x.Id, x.FormattedValue)));
        
        return JsonSerializer.Serialize(result, typeof(Dictionary<MetadataFieldId, string>), MetadataJsonContext.Custom);
    }

    public void Dispose() => _reader?.Dispose();
}
