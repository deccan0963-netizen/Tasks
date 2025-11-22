using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using TaskManagement.Models.Enums;

namespace TaskManagement.Models
{
    [Table("TB_TASKS")]
    public class TaskBo : BaseEntity
    {
        [Key]
        [Column("ID")]
        public int Id { get; set; }

        [Required(ErrorMessage = "Task Name is required.")]
        [Column("TASK_NAME")]
        public string TaskName { get; set; }

        [Required(ErrorMessage = "Department is required.")]
        [Column("DEPARTMENT")]
        public int Department { get; set; }

        [Required(ErrorMessage = "Project is required.")]
        [Column("PROJECT_ID")]
        public int ProjectId { get; set; }

        [Required(ErrorMessage = "Assigned Users is required.")]
        [Column("ASSIGNED_USERS")]
        public string AssignedUsers { get; set; }

        [Required(ErrorMessage = "Assigned By is required.")]
        [Column("ASSIGNED_BY")]
        public string AssignedBy { get; set; }  // New field for Assigned By

        [Required(ErrorMessage = "Due Date is required.")]
        [Column("DUE_DATE", TypeName = "timestamp with time zone")]
        public DateTime DueDate { get; set; }

        [Column("COMPLETED_DATE", TypeName = "timestamp with time zone")]
        public DateTime? CompletedDate { get; set; }  // New field for Completed Date

        [Column("DESCRIPTION")]
        public string Description { get; set; }

        [Column("STATUS")]
        public StatusEnum Status { get; set; }

        // Navigation property
        [ForeignKey("ProjectId")]
        public virtual ProjectBo Project { get; set; }

        [NotMapped]
        public int ProgressPercent { get; set; }

        [NotMapped]
        public List<string> SelectedUserNames
        {
            get
            {
                if (!string.IsNullOrEmpty(AssignedUsers))
                {
                    return AssignedUsers
                        .Split(',', StringSplitOptions.RemoveEmptyEntries)
                        .Select(u => u.Trim())
                        .ToList();
                }
                return new List<string>();
            }
            set
            {
                AssignedUsers =
                    value != null && value.Count > 0 ? string.Join(",", value) : string.Empty;
            }
        }
    }
}
