/*
Author: Padraig McCauley - 20123744
BiggerPhish Educational Platform


TODO:
Add the delete user funtion - this will need to remove all course infoirmation/any mention of the user/GDPR 'Right to Dissapear' function
*/

var email = null;

document.addEventListener('DOMContentLoaded', function () {
    fetch('/user-data')
        .then(response => response.json())
        .then(data => {
            document.getElementById('user-email').value = data['User-Email'];
            document.getElementById('user-name').value = data['User-FName'];
            email = data['User-Email'];
        })
        .catch(error => {
            console.error('Error:', error);
        });

    var editBtn = document.getElementById('edit-details-btn');
    if (editBtn) {
        editBtn.addEventListener('click', function () {
            var fields = document.querySelectorAll('#settings-form .form-control');
            var updateButtons = document.querySelectorAll('.update-button');
            fields.forEach(field => {
                field.readOnly = !field.readOnly;
            });
            updateButtons.forEach(button => {
                button.disabled = !button.disabled;
            });
        });
    }

    var updateEmailBtn = document.getElementById('update-email-btn');
    if (updateEmailBtn) {
        updateEmailBtn.addEventListener('click', function (event) {
            event.preventDefault();
            var newEmail = document.getElementById('user-email').value;
            fetch('/update-user-email', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        oldEmail: email,
                        newEmail: newEmail
                    })
                })
                .then(response => {
                    if (!response.ok) {
                        throw new Error(`Network response was not ok: ${response.statusText}`);
                    }
                    return response.json();
                })
                .then(data => {
                    if (data.success) {
                        alert('Email updated successfully');
                        location.reload(); // Reload the page
                    } else {
                        alert('Failed to update email: ' + data.message);
                    }
                })
                .catch(error => {
                    console.error('Error updating email:', error);
                });
        });
    }

    var updatePasswordBtn = document.getElementById('update-password-btn');
    if (updatePasswordBtn) {
        updatePasswordBtn.addEventListener('click', function (event) {
            event.preventDefault();
            document.getElementById('passwordModal').style.display = 'block';
        });
    }

    function closeModal() {
        document.getElementById('passwordModal').style.display = 'none';
    }

    function updatePassword() {
        var currentPassword = document.getElementById('current-password').value;
        var newPassword = document.getElementById('new-password').value;
        var confirmNewPassword = document.getElementById('confirm-new-password').value;

        if (!currentPassword || !newPassword || !confirmNewPassword) {
            alert("All fields are required.");
            return;
        }

        if (newPassword !== confirmNewPassword) {
            alert("The new passwords do not match.");
            return;
        }

        fetch('/update-user-password', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    currentPassword: currentPassword,
                    newPassword: newPassword
                })
            })
            .then(response => {
                if (!response.ok) {
                    throw new Error(`Network response was not ok: ${response.statusText}`);
                }
                return response.json();
            })
            .then(data => {
                if (data.success) {
                    alert('Password updated successfully');
                    location.reload(); // Optionally reload the page or close the modal
                    closeModal();
                } else {
                    alert('Failed to update password: ' + data.message);
                }
            })
            .catch(error => {
                console.error('Error updating password:', error);
            });

    }


    var updateNameBtn = document.getElementById('update-name-btn');
    if (updateNameBtn) {
        updateNameBtn.addEventListener('click', function (event) {
            event.preventDefault();
            var newName = document.getElementById('user-name').value;
            fetch('/update-user-name', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        email: email,
                        newFName: newName
                    })
                })
                .then(response => {
                    if (!response.ok) {
                        throw new Error(`Network response was not ok: ${response.statusText}`);
                    }
                    return response.json();
                })
                .then(data => {
                    if (data.success) {
                        alert('Name updated successfully');
                        location.reload(); // Reload the page
                    } else {
                        alert('Failed to update name: ' + data.message);
                    }
                })
                .catch(error => {
                    console.error('Error updating name:', error);
                });
        });
    }



    var deleteAccountBtn = document.getElementById('delete-account-btn');
    if (deleteAccountBtn) {
        deleteAccountBtn.addEventListener('click', function (event) {
            event.preventDefault();
            if (confirm('Are you sure you want to delete your account? This action cannot be undone.')) {
                fetch('/delete-account', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                    })
                    .then(response => response.json())
                    .then(data => {
                        console.log('Account deletion requested:', data);
                    })
                    .catch(error => {
                        console.error('Error requesting account deletion:', error);
                    });
            }
        });
    }
});