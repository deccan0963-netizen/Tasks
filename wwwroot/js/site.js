// Please see documentation at https://learn.microsoft.com/aspnet/core/client-side/bundling-and-minification
// for details on configuring this project to bundle and minify static web assets.

// Write your JavaScript code.

$('.select2').select2({
    placeholder: 'Select', allowClear: true,
    width: '100%'
});

$(document).ready(function (e) {
    $('.datepicker').datepicker({
        format: "dd/MM/yyyy",
    });
});
