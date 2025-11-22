using System;
using Microsoft.AspNetCore.Mvc;
using TaskManagement.Models;

namespace TaskManagement.Controllers
{
    public class BaseController : Controller
    {
        protected int GetCurrentUserId()
        {
            return 1;
        }

        protected void SetCreatedFields(BaseEntity entity)
        {
            var userId = GetCurrentUserId();
            entity.CreatedBy = userId;
            entity.UpdatedBy = userId;
            entity.CreatedTime = DateTime.UtcNow;
            entity.UpdatedTime = DateTime.UtcNow;
            entity.IsDeleted = "N";
            entity.IsDisabled = "N";
        }

        protected void SetUpdatedFields(BaseEntity entity)
        {
            var userId = GetCurrentUserId();
            entity.UpdatedBy = userId;
            entity.UpdatedTime = DateTime.UtcNow;
        }
        // protected void SetUpdatedFields(BaseEntity entity)
        // {
        //     var userId = GetCurrentUserId();
        //     entity.UpdatedBy = userId;
        //     entity.UpdatedTime = DateTime.UtcNow;
        // }

      
    }
}
