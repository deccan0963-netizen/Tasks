using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using TaskManagement.Models.Enums;

namespace TaskManagement.Models
{
    [Table("TB_TASK_PROJECTS")]
    public class ProjectBo : BaseEntity
    {
        [Key]
        [Column("ID")]
        public int Id { get; set; }

        [Required]
        [Column("PROJECT_ID")]
        public ProjectEnum ProjectId { get; set; }

        [Required]
        [Column("LOCATION")]
        public LocationEnum Location { get; set; }

        [Column("DEPARTMENT")]
        public int Department { get; set; }

        [Required(ErrorMessage = "Assigned Users is required.")]
        [Column("ASSIGNED_USERS")]
        public string AssignedUsers { get; set; }

        [Required(ErrorMessage = "Assigned By is required.")]
        [Column("ASSIGNED_BY")]
        public string AssignedBy { get; set; } 

        [Column("CLIENT")]
        public string Clients { get; set; }

        [Required]
        [Column("START_DATE", TypeName = "timestamp with time zone")]
        public DateTime StartDate { get; set; }

        [Column("END_DATE", TypeName = "timestamp with time zone")]
        public DateTime? EndDate { get; set; }

        [Column("DESCRIPTION")]
        public string Description { get; set; }

        [Column("STATUS")]
        public StatusEnum Status { get; set; }

        [NotMapped]
        public int ProgressPercent
        {
            get
            {
                if (Tasks == null || !Tasks.Any())
                    return 0;
                return (int)Tasks.Average(t => t.ProgressPercent);
            }
        }

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

        public virtual ICollection<TaskBo> Tasks { get; set; }
    }
}
