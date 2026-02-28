using XRay;

class Program
{
    static int Main(string[] args)
    {
        if (args.Length < 1)
        {
            Console.WriteLine("Usage: XRayConverter <input.stl>");
            return 1;
        }

        string inputPath = args[0];
        string outputPath = Path.ChangeExtension(inputPath, ".png");

        if (!File.Exists(inputPath))
        {
            Console.Error.WriteLine($"Error: file not found: {inputPath}");
            return 1;
        }

        try
        {
            var reader = new XRayFileReader(inputPath);

            Console.WriteLine("=== Header Metadata ===");

            foreach (var metadataField in reader.ExtractMetadata())
            {
                Console.WriteLine($"  {metadataField.Id,-16}: {metadataField.FormattedValue}");
            }

            Console.WriteLine();

            var pngBytes = reader.GetPngBuffer();

            string? dir = Path.GetDirectoryName(outputPath);

            if (!string.IsNullOrEmpty(dir))
            {
                Directory.CreateDirectory(dir);
            }

            File.WriteAllBytes(outputPath, pngBytes);

            Console.WriteLine($"Saved: {outputPath}");
            return 0;
        }
        catch (Exception ex)
        {
            Console.Error.WriteLine($"Error: {ex.Message}");
            return 1;
        }
    }
}
