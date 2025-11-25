using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using FluentResults;
using Microsoft.EntityFrameworkCore;
using TaskManagement.Data;
using TaskManagement.Interfaces;
using TaskManagement.Models;

namespace TaskManagement.Repositories
{
    public class ProjectRepository : IProjectInterface
    {
        private readonly TaskManagementContext _context;

        public ProjectRepository(TaskManagementContext context)
        {
            _context = context;
        }

        public async Task<Result<ProjectBo>> AddAsync(ProjectBo project)
        {
            try
            {
                project.StartDate = DateTime.SpecifyKind(project.StartDate, DateTimeKind.Utc);
                project.EndDate = project.EndDate.HasValue
                    ? DateTime.SpecifyKind(project.EndDate.Value, DateTimeKind.Utc)
                    : null;

                project.CreatedTime = DateTime.UtcNow;

                _context.Projects.Add(project);
                await _context.SaveChangesAsync();

                return Result.Ok(project);
            }
            catch (Exception ex)
            {
                return Result.Fail<ProjectBo>($"Error adding project: {ex.Message}");
            }
        }

        public async Task<Result<ProjectBo>> UpdateAsync(
            ProjectBo project,
            List<int> selectedUserNames
        )
        {
            try
            {
                var existing = await _context.Projects.FindAsync(project.Id);
                if (existing == null)
                    return Result.Fail<ProjectBo>("Project not found");

                existing.IsDisabled = "Y";
                existing.UpdatedTime = DateTime.UtcNow;
                _context.Projects.Update(existing);
                // Update fields
                existing.ProjectName = project.ProjectName;
                existing.Location = project.Location;
                existing.Department = project.Department;
                existing.Concern = project.Concern;
                existing.Clients = project.Clients;
                existing.Description = project.Description;
                existing.Status = project.Status;

                existing.StartDate = DateTime.SpecifyKind(project.StartDate, DateTimeKind.Utc);
                existing.EndDate = project.EndDate.HasValue
                    ? DateTime.SpecifyKind(project.EndDate.Value, DateTimeKind.Utc)
                    : null;

                existing.SelectedUserNames = selectedUserNames;
                existing.AssignedUsers = string.Join(",", selectedUserNames);

                existing.AssignedBy = project.AssignedBy;
                existing.UpdatedTime = DateTime.UtcNow;

                // Save IsDisabled
                existing.IsDisabled = project.IsDisabled;

                _context.Projects.Update(existing);
                await _context.SaveChangesAsync();

                return Result.Ok(existing);
            }
            catch (Exception ex)
            {
                return Result.Fail<ProjectBo>($"Error updating project: {ex.Message}");
            }
        }

        public async Task<Result<bool>> DeleteAsync(int id)
        {
            try
            {
                var project = await _context.Projects.FindAsync(id);
                if (project == null)
                    return Result.Fail<bool>("Project not found");

                project.IsDeleted = "Y";
                project.UpdatedTime = DateTime.UtcNow;

                await _context.SaveChangesAsync();
                return Result.Ok(true);
            }
            catch (Exception ex)
            {
                var inner = ex.InnerException?.Message ?? ex.Message;
                return Result.Fail<bool>($"Error deleting project: {inner}");
            }
        }

        public async Task<Result<List<ProjectBo>>> GetAllIncludingCompletedAsync()
        {
            try
            {
                var projects = await _context
                    .Projects.Where(p => p.IsDeleted == "N") // include completed and active projects
                    .OrderByDescending(p => p.CreatedTime)
                    .ToListAsync();

                return Result.Ok(projects);
            }
            catch (Exception ex)
            {
                return Result.Fail<List<ProjectBo>>($"Error retrieving projects: {ex.Message}");
            }
        }

        public async Task<Result<List<ProjectBo>>> GetAllAsync()
        {
            try
            {
                var projects = await _context
                    .Projects.Where(p => p.IsDeleted == "N" && p.IsDisabled == "N")
                    .OrderByDescending(p => p.CreatedTime)
                    .Take(10)
                    .ToListAsync();

                return Result.Ok(projects);
            }
            catch (Exception ex)
            {
                var inner = ex.InnerException?.Message ?? ex.Message;
                return Result.Fail<List<ProjectBo>>($"Error retrieving projects: {inner}");
            }
        }

        public async Task<Result<ProjectBo>> GetByIdAsync(int id)
        {
            try
            {
                var project = await _context.Projects.FirstOrDefaultAsync(p =>
                    p.Id == id && p.IsDeleted == "N" && p.IsDisabled == "N"
                );

                return project == null
                    ? Result.Fail<ProjectBo>("Project not found")
                    : Result.Ok(project);
            }
            catch (Exception ex)
            {
                var inner = ex.InnerException?.Message ?? ex.Message;
                return Result.Fail<ProjectBo>($"Error retrieving project: {inner}");
            }
        }

        // NEW: Get projects by department
        public async Task<Result<List<ProjectBo>>> GetProjectsByDepartmentAsync(int departmentId)
        {
            try
            {
                var projects = await _context
                    .Projects.Where(p =>
                        p.Department == departmentId && p.IsDeleted == "N" && p.IsDisabled == "N"
                    )
                    .OrderByDescending(p => p.CreatedTime)
                    .ToListAsync();

                return Result.Ok(projects);
            }
            catch (Exception ex)
            {
                var inner = ex.InnerException?.Message ?? ex.Message;
                return Result.Fail<List<ProjectBo>>(
                    $"Error retrieving projects by department: {inner}"
                );
            }
        }
    }
}
