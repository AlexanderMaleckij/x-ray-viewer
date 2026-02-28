namespace XRay.Metadata;

public sealed record MetadataFieldValue
{
    public MetadataFieldId Id { get; init; }

    public string RawValue { get; init; }

    public string FormattedValue { get; init; }
}
