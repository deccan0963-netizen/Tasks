public class RolePermessionDto
{
    public int PermissionId { get; set; }
    public string? PrimaryActionName { get; set; }
    public string? SecondaryActionName { get; set; }
    public string DisplayName { get; set; } = string.Empty;
}