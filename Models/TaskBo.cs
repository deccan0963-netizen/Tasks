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

        [Column("DEPARTMENT")]
        public int? Department { get; set; }

        [Required(ErrorMessage = "Project is required.")]
        [Column("PROJECT_ID")]
        public int ProjectId { get; set; }

        [Required(ErrorMessage = "Assigned Users is required.")]
        [Column("ASSIGNED_USERS")]
        public string AssignedUsers { get; set; }

        [Required(ErrorMessage = "Assigned By is required.")]
        [Column("ASSIGNED_BY")]
        public string AssignedBy { get; set; }

        [Required(ErrorMessage = "Due Date is required.")]
        [Column("DUE_DATE", TypeName = "timestamp with time zone")]
        public DateTime DueDate { get; set; }

        [Column("COMPLETED_DATE", TypeName = "timestamp with time zone")]
        public DateTime? CompletedDate { get; set; }

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
        public List<int> SelectedUserNames
        {
            get
            {
                if (!string.IsNullOrEmpty(AssignedUsers))
                {
                    var ids = new List<int>();
                    foreach (var s in AssignedUsers.Split(','))
                    {
                        if (int.TryParse(s.Trim(), out int id))
                        {
                            ids.Add(id);
                        }
                    }
                    return ids;
                }
                return new List<int>();
            }
            set
            {

                AssignedUsers = string.Join(",", value.Where(id => id > 0));
            }
        }
    }
}
