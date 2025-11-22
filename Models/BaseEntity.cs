using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace TaskManagement.Models
{
    public class BaseEntity
    {
        [Column("CREATEDBY")]
        public int? CreatedBy { get; set; }

        [Column("UPDATEDBY")]
        public int? UpdatedBy { get; set; }

        [Column("CREATEDTIME")]
        public DateTime? CreatedTime { get; set; }

        [Column("UPDATEDTIME")]
        public DateTime? UpdatedTime { get; set; }

        [Required, Column("IS_DELETED", TypeName = "varchar(1)")]
        public string IsDeleted { get; set; } = "N";

        [Column("IS_DISABLED")]
        public string IsDisabled { get; set; } = "N";
    }
}
