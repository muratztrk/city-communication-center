namespace CityCommunicationCenter.Application.Common;

/// <summary>
/// Türkiye resmi tatil günleri (sabit + dini bayramlar). Yıllık dini tarihler resmi takvimle güncellenir (#3382).
/// </summary>
public static class TurkishPublicHolidayCalendar
{
    private static readonly HashSet<(int Month, int Day)> FixedHolidays =
    [
        (1, 1),
        (4, 23),
        (5, 1),
        (5, 19),
        (7, 15),
        (8, 30),
        (10, 29),
    ];

    private static readonly Dictionary<int, DateOnly[]> VariableHolidaysByYear = new()
    {
        [2024] =
        [
            new DateOnly(2024, 4, 10), new DateOnly(2024, 4, 11), new DateOnly(2024, 4, 12),
            new DateOnly(2024, 6, 16), new DateOnly(2024, 6, 17), new DateOnly(2024, 6, 18), new DateOnly(2024, 6, 19),
        ],
        [2025] =
        [
            new DateOnly(2025, 3, 30), new DateOnly(2025, 3, 31), new DateOnly(2025, 4, 1),
            new DateOnly(2025, 6, 6), new DateOnly(2025, 6, 7), new DateOnly(2025, 6, 8), new DateOnly(2025, 6, 9),
        ],
        [2026] =
        [
            new DateOnly(2026, 3, 19), new DateOnly(2026, 3, 20), new DateOnly(2026, 3, 21),
            new DateOnly(2026, 5, 27), new DateOnly(2026, 5, 28), new DateOnly(2026, 5, 29), new DateOnly(2026, 5, 30),
        ],
        [2027] =
        [
            new DateOnly(2027, 3, 8), new DateOnly(2027, 3, 9), new DateOnly(2027, 3, 10),
            new DateOnly(2027, 5, 16), new DateOnly(2027, 5, 17), new DateOnly(2027, 5, 18), new DateOnly(2027, 5, 19),
        ],
        [2028] =
        [
            new DateOnly(2028, 2, 26), new DateOnly(2028, 2, 27), new DateOnly(2028, 2, 28),
            new DateOnly(2028, 5, 5), new DateOnly(2028, 5, 6), new DateOnly(2028, 5, 7), new DateOnly(2028, 5, 8),
        ],
        [2029] =
        [
            new DateOnly(2029, 2, 14), new DateOnly(2029, 2, 15), new DateOnly(2029, 2, 16),
            new DateOnly(2029, 4, 24), new DateOnly(2029, 4, 25), new DateOnly(2029, 4, 26), new DateOnly(2029, 4, 27),
        ],
        [2030] =
        [
            new DateOnly(2030, 2, 3), new DateOnly(2030, 2, 4), new DateOnly(2030, 2, 5),
            new DateOnly(2030, 4, 13), new DateOnly(2030, 4, 14), new DateOnly(2030, 4, 15), new DateOnly(2030, 4, 16),
        ],
    };

    public static bool IsPublicHoliday(DateTime localDate)
    {
        if (FixedHolidays.Contains((localDate.Month, localDate.Day)))
        {
            return true;
        }

        if (!VariableHolidaysByYear.TryGetValue(localDate.Year, out var variable))
        {
            return false;
        }

        var date = DateOnly.FromDateTime(localDate.Date);
        return variable.Contains(date);
    }
}
