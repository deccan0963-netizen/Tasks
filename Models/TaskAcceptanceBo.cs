using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace TaskManagement.Models
{
    [Table("TB_TASK_ACCEPTANCE")]
    public class TaskAcceptanceBo : BaseEntity
    {
        [Key]
        [Column("ID")]
        public int Id { get; set; }

        [Required]
        [Column("TASK_ID")]
        public int TaskId { get; set; }

        [Required]
        [Column("USER_ID")]
        public string UserId { get; set; } 

        [Column("ACCEPTED_DATE", TypeName = "timestamp with time zone")]
        public DateTime AcceptedDate { get; set; } = DateTime.UtcNow; 
    }
}
