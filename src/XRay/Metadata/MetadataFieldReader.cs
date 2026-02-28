namespace XRay.Metadata;

internal sealed class MetadataFieldReader(ReadOnlyMemory<byte> file)
{
    public MetadataFieldValue Read(MetadataField field)
    {
        int end = field.Offset;

        // Find the end of the string.
        while (end < field.Offset + field.MaxLength && file.Span[end] != 0)
        {
            end++;
        }

        var value = field.Encoding.GetString(file.Span[field.Offset..end]);

        return new MetadataFieldValue
        {
            Id = field.Id,
            RawValue = value,
            FormattedValue = field.FormatValue(value)
        };
    }
}
