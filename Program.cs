using Microsoft.EntityFrameworkCore;
using TaskManagement.Data;
using TaskManagement.Interfaces;
using TaskManagement.Repositories;
using TaskManagement.Service;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container
builder
    .Services.AddControllersWithViews()
    .AddJsonOptions(options =>
    {
        options.JsonSerializerOptions.ReferenceHandler = System
            .Text
            .Json
            .Serialization
            .ReferenceHandler
            .Preserve;
        options.JsonSerializerOptions.MaxDepth = 64;
    });

// Add EF Core + Npgsql for PostgreSQL
var conn = builder.Configuration.GetConnectionString("DefaultConnection");
builder.Services.AddDbContext<TaskManagementContext>(options => options.UseNpgsql(conn));

// Register repositories
builder.Services.AddScoped<IProjectInterface, ProjectRepository>();
builder.Services.AddScoped<ITaskInterface, TaskRepository>();
builder.Services.AddScoped<ITaskAcceptanceInterface, TaskAcceptanceRepository>();

// Register singleton loaders
builder.Services.AddSingleton<ApiDepartmentLoad>();
builder.Services.AddSingleton<ApiUserLoader>();
builder.Services.AddSingleton<ApiConcernLoad>();

// Register RolePrivilegeService & supporting services
builder.Services.AddScoped<RolePrivilegeService>();
builder.Services.AddSingleton<IHttpContextAccessor, HttpContextAccessor>();
builder.Services.AddMemoryCache();

builder.Services.AddSingleton<IErrorLogger, ErrorLogger>();

var app = builder.Build();

// Middleware
if (!app.Environment.IsDevelopment())
{
    app.UseExceptionHandler("/Home/Error");
    app.UseHsts();
}

app.UseHttpsRedirection();
app.UseStaticFiles();
app.UseRouting();
app.UseAuthentication();
app.UseAuthorization();


// Default route
app.MapControllerRoute(name: "default", pattern: "{controller=ManageTasks}/{action=Index}/{id?}");

app.Run();
