using System.ComponentModel;

namespace TaskManagement.Models.Enums
{
    public enum ProjectEnum
    {
        [Description("Indexer")]
        Indexer = 1,

        [Description("Task Management")]
        TaskManagement = 2,

        [Description("T & A")]
        TAndA = 3,

        [Description("Certification")]
        Certification = 4,

        [Description("SAB Nesty")]
        SABNesty = 5,

        [Description("Fuel")]
        Fuel = 6,

        [Description("EB Meter")]
        EBMeter = 7,

        [Description("Gatepass")]
        Gatepass = 8,

        [Description("Invoice bill")]
        InvoiceBill = 9,
    }
}
