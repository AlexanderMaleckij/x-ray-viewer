using System.Text;

namespace XRay.Metadata;

public class MetadataField(MetadataFieldId id, int offset, int maxLength, Encoding? encoding = null)
{
    public MetadataFieldId Id { get; } = id;

    public int Offset { get; } = offset;

    public int MaxLength { get; } = maxLength;

    public Encoding Encoding { get; } = encoding ?? Encoding.GetEncoding(1251);

    public virtual string FormatValue(string raw) => raw.Trim();
}
