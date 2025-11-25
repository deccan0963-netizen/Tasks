using System.Collections.Generic;
using System.Threading.Tasks;
using FluentResults;
using TaskManagement.Models;

namespace TaskManagement.Interfaces
{
    public interface IProjectInterface
    {
        Task<Result<ProjectBo>> AddAsync(ProjectBo project);
        Task<Result<ProjectBo>> UpdateAsync(ProjectBo project, List<int> selectedUserNames);
        Task<Result<bool>> DeleteAsync(int id);
        Task<Result<List<ProjectBo>>> GetAllAsync();
        Task<Result<ProjectBo>> GetByIdAsync(int id);
        Task<Result<List<ProjectBo>>> GetProjectsByDepartmentAsync(int departmentId); 
        Task<Result<List<ProjectBo>>> GetAllIncludingCompletedAsync();
// NEW METHOD
    }
}