using System.Globalization;
using System.Text;

namespace XRay.Metadata;

public sealed class DateMetadataField(MetadataFieldId id, int offset)
    : MetadataField(id, offset, DateFieldLength, Encoding.ASCII)
{
    private const int DateFieldLength = 8;

    public override string FormatValue(string raw)
    {
        if (raw.Length == DateFieldLength && DateTime.TryParseExact(raw, "ddMMyyyy", null, DateTimeStyles.AssumeLocal, out var date))
        {
            if (date.TimeOfDay == TimeSpan.Zero)
            {
                return date.ToShortDateString();
            }

            return date.ToString();
        }

        return raw;
    }
}
