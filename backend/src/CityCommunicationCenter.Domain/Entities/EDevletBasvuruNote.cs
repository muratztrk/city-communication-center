namespace CityCommunicationCenter.Domain.Entities;

public sealed record EDevletBasvuruNote(DateTimeOffset At, string Kind, string Text)
{
    public const string KindNote = "Not";
    public const string KindReopen = "TekrarAcma";
}
