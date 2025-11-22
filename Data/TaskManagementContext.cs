using Microsoft.EntityFrameworkCore;
using TaskManagement.Models;
using TaskManagement.Models.Enums;

namespace TaskManagement.Data
{
    public class TaskManagementContext : DbContext
    {
        public TaskManagementContext(DbContextOptions<TaskManagementContext> options)
            : base(options) { }

        public DbSet<ProjectBo> Projects { get; set; }
        public DbSet<TaskBo> Tasks { get; set; }
        public DbSet<TaskAcceptanceBo> TaskAcceptances { get; set; }

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            // Map tables
            modelBuilder.Entity<ProjectBo>().ToTable("TB_TASK_PROJECTS");
            modelBuilder.Entity<TaskBo>().ToTable("TB_TASKS");
            modelBuilder.Entity<TaskAcceptanceBo>().ToTable("TB_TASK_ACCEPTANCE");

            // Configure ProjectBo
            modelBuilder.Entity<ProjectBo>(entity =>
            {
                entity.HasKey(p => p.Id);

                // Configure enum conversion for ProjectId
                entity.Property(p => p.ProjectId).HasConversion<int>().IsRequired();

                // Configure enum conversion for Location
                entity.Property(p => p.Location).HasConversion<int>().IsRequired();

                // Configure enum conversion for Status
                entity.Property(p => p.Status).HasConversion<int>();
            });

            // Configure TaskBo
            modelBuilder.Entity<TaskBo>(entity =>
            {
                entity.HasKey(t => t.Id);

                // Configure the relationship
                entity
                    .HasOne(t => t.Project)
                    .WithMany(p => p.Tasks)
                    .HasForeignKey(t => t.ProjectId)
                    .OnDelete(DeleteBehavior.Restrict);

                // Configure enum conversion for Status
                entity.Property(t => t.Status).HasConversion<int>();
            });

            base.OnModelCreating(modelBuilder);
        }
    }
}
