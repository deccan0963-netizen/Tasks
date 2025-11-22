using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;
using TaskManagement.Models.GlobalData;
using TaskManagement.Service;

namespace TaskManagement.Filters
{
    [AttributeUsage(AttributeTargets.Method | AttributeTargets.Class)]
    public class PermissionFilterAttribute : Attribute, IAsyncActionFilter
    {
        private readonly string _primaryAction;
        private readonly string _secondaryAction;

        public PermissionFilterAttribute(string primaryAction, string secondaryAction = "")
        {
            _primaryAction = primaryAction;
            _secondaryAction = secondaryAction;
        }

        public async Task OnActionExecutionAsync(
            ActionExecutingContext context,
            ActionExecutionDelegate next
        )
        {
            try
            {
                var rolePrivilegeService =
                    context.HttpContext.RequestServices.GetService<RolePrivilegeService>();

                if (rolePrivilegeService == null)
                {
                    context.Result = new JsonResult(
                        new { message = "Internal error: RolePrivilegeService not available." }
                    )
                    {
                        StatusCode = StatusCodes.Status500InternalServerError,
                    };
                    return;
                }

                bool hasPermission = GlobalUserData.globalRolePermessionList.Any(rp =>
                    rp.PrimaryActionName.Equals(_primaryAction, StringComparison.OrdinalIgnoreCase)
                    && rp.SecondaryActionName.Equals(
                        _secondaryAction,
                        StringComparison.OrdinalIgnoreCase
                    )
                );

                // bool hasPermission = true;

                if (!hasPermission)
                {
                    // No permission: redirect to AccessDenied action
                    context.Result = new RedirectToActionResult("AccessDenied", "Home", null);
                    return;
                }

                await next();
            }
            catch (Exception ex)
            {
                context.Result = new JsonResult(
                    new
                    {
                        message = "Unexpected error while checking permissions.",
                        details = ex.Message,
                    }
                )
                {
                    StatusCode = StatusCodes.Status500InternalServerError,
                };
            }
        }
    }
}
