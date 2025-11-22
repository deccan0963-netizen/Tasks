using System.ComponentModel;

namespace TaskManagement.Models.Enums
{
    public enum StatusEnum
    {
        [Description("Active")]
        Active = 0,

        [Description("Pending")]
        Pending = 1,

        [Description("In Progress")]
        InProgress = 2,

        [Description("Completed")]
        Completed = 3
    }
}
