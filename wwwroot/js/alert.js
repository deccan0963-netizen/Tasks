function successAlert(msg, type, url) {
  Swal.fire({
    position: "center",
    icon: type,
    title: msg,
    showConfirmButton: true,
    // @* timer: 3000, *@
    customClass: "swal-size-sm",
  });

  if (url != "") {
    $(".swal2-confirm").click(function () {
      window.location.href = url;
    });
  }

  if (url == "#") {
    $(".swal2-confirm").click(function () {
      window.location.reload();
    });
  }

  if (url == "##") {
    $(".swal2-confirm").click(function () {
      Swal.fire({
        title: 'Are you sure?',
        text: "Do you really want to logout now?",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#3085d6',
        cancelButtonColor: '#d33',
        confirmButtonText: 'Yes!'
      }).then((result) => {
        if (result.isConfirmed) {
          window.location.href = "/Account/Logout";
          // window.open("/Account/Logout", 'parent');
          window.history.forward();

          // $('.logout').trigger('click')
        }
        else {
          window.location.reload();
        }
      })
    });
  }



}

function errorAlert(msg, type, url) {
  Swal.fire({
    position: "center",
    icon: type,
    title: msg,
    showConfirmButton: true,
    // @* timer: 3000, *@
    customClass: "swal-size-sm",
  });
  if (url != "") {
    $(".swal2-confirm").click(function () {
      window.location.href = url;
    });

    if (url == "#") {
      $(".swal2-confirm").click(function () {
        window.location.reload();
      });
    }
    if (url == "##") {
      Swal.fire({
        position: "center",
        icon: "warning",
        title: msg,
        showConfirmButton: true,
        // @* timer: 3000, *@
        customClass: "swal-size-sm",
      });
    }
  }
}
