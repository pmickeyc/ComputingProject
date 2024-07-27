// add event listener for when the document is fully loaded
document.addEventListener('DOMContentLoaded', function () {
    fetchUserData(); // fetch user data

    setupEditDetailsButton(); // setup edit details button
    setupUpdateEmailButton(); // setup update email button
    setupUpdatePasswordButton(); // setup update password button
    setupUpdateNameButton(); // setup update name button
    setupDeleteAccountButton(); // setup delete account button
});

// function to fetch user data
function fetchUserData() {
    fetch('/user-data')
        .then(response => response.json())
        .then(data => {
            document.getElementById('user-email').value = data['User-Email'];
            document.getElementById('user-name').value = data['User-FName'];
            email = data['User-Email'];
        })
        .catch(error => {
            console.error('error:', error);
        });
}

// function to setup edit details button
function setupEditDetailsButton() {
    var editBtn = document.getElementById('edit-details-btn');
    if (editBtn) {
        editBtn.addEventListener('click', toggleEditMode);
    }
}

// function to toggle edit mode
function toggleEditMode() {
    var fields = document.querySelectorAll('#settings-form .form-control');
    var updateButtons = document.querySelectorAll('.update-button');
    fields.forEach(field => {
        field.readOnly = !field.readOnly;
    });
    updateButtons.forEach(button => {
        button.disabled = !button.disabled;
    });
}

// function to setup update email button
function setupUpdateEmailButton() {
    var updateEmailBtn = document.getElementById('update-email-btn');
    if (updateEmailBtn) {
        updateEmailBtn.addEventListener('click', function (event) {
            event.preventDefault();
            updateEmail();
        });
    }
}

// function to update email
function updateEmail() {
    fetch('/csrf-token')
        .then(response => response.json())
        .then(data => {
            const csrfToken = data.csrfToken; // set the csrf token value
            var newEmail = document.getElementById('user-email').value;
            fetch('/update-user-email', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'CSRF-Token': csrfToken
                },
                body: JSON.stringify({
                    oldEmail: email,
                    newEmail: newEmail
                })
            })
            .then(response => response.json().then(data => ({status: response.status, body: data}))) // parse both status and body
            .then(({status, body}) => {
                if (status === 200) {
                    alert(body.message);
                    location.reload(); // reload the page
                } else {
                    alert('failed to update email: ' + body.message);
                }
            })
            .catch(error => {
                console.error('error updating email:', error);
                alert('failed to update email due to network error.');
            });
        })
        .catch(error => {
            console.error('error fetching csrf token:', error);
        });
}

// function to setup update password button
function setupUpdatePasswordButton() {
    var updatePasswordBtn = document.getElementById('update-password-btn');
    if (updatePasswordBtn) {
        updatePasswordBtn.addEventListener('click', function (event) {
            event.preventDefault();
            clearPasswordFields();
            $('#passwordModal').modal('show');
            removeReadOnlyAttributes(); // remove readonly attributes when the modal is shown
        });
    }

    var passwordForm = document.getElementById('password-form');
    if (passwordForm) {
        passwordForm.addEventListener('submit', function (event) {
            event.preventDefault();
            updatePassword();
        });
    }
}

// function to clear password fields
function clearPasswordFields() {
    document.getElementById('current-password').value = '';
    document.getElementById('new-password').value = '';
    document.getElementById('confirm-new-password').value = '';
}

// function to remove readonly attributes
function removeReadOnlyAttributes() {
    document.getElementById('current-password').removeAttribute('readonly');
    document.getElementById('new-password').removeAttribute('readonly');
    document.getElementById('confirm-new-password').removeAttribute('readonly');
}

// function to update password
function updatePassword() {
    fetch('/csrf-token')
        .then(response => response.json())
        .then(data => {
            const csrfToken = data.csrfToken; // set the csrf token value

            var currentPassword = document.getElementById('current-password').value;
            var newPassword = document.getElementById('new-password').value;
            var confirmNewPassword = document.getElementById('confirm-new-password').value;

            if (!currentPassword || !newPassword || !confirmNewPassword) {
                alert("all fields are required.");
                return;
            }

            if (newPassword !== confirmNewPassword) {
                alert("the new passwords do not match.");
                return;
            }

            fetch('/update-user-password', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'CSRF-Token': csrfToken
                },
                body: JSON.stringify({
                    currentPassword: currentPassword,
                    newPassword: newPassword
                })
            })
            .then(response => {
                if (!response.ok) {
                    throw new Error(`network response was not ok: ${response.statusText}`);
                }
                return response.json();
            })
            .then(data => {
                if (data.success) {
                    alert('password updated successfully');
                    location.reload(); // optionally reload the page or close the modal
                    $('#passwordModal').modal('hide');
                } else {
                    alert('failed to update password: ' + data.message);
                }
            })
            .catch(error => {
                console.error('error updating password:', error);
            });
        })
        .catch(error => {
            console.error('error fetching csrf token:', error);
        });
}

// function to setup update name button
function setupUpdateNameButton() {
    var updateNameBtn = document.getElementById('update-name-btn');
    if (updateNameBtn) {
        updateNameBtn.addEventListener('click', function (event) {
            event.preventDefault();
            updateName();
        });
    }
}

// function to update name
function updateName() {
    fetch('/csrf-token')
        .then(response => response.json())
        .then(data => {
            const csrfToken = data.csrfToken; // set the csrf token value

            var newName = document.getElementById('user-name').value;
            fetch('/update-user-name', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'CSRF-Token': csrfToken
                },
                body: JSON.stringify({
                    email: email,
                    newFName: newName
                })
            })
            .then(response => {
                if (!response.ok) {
                    throw new Error(`network response was not ok: ${response.statusText}`);
                }
                return response.json();
            })
            .then(data => {
                if (data.success) {
                    alert('name updated successfully');
                    location.reload(); // reload the page
                } else {
                    alert('failed to update name: ' + data.message);
                }
            })
            .catch(error => {
                console.error('error updating name:', error);
            });
        })
        .catch(error => {
            console.error('error fetching csrf token:', error);
        });
}

// function to setup delete account button
function setupDeleteAccountButton() {
    var deleteAccountBtn = document.getElementById('delete-account-btn');
    if (deleteAccountBtn) {
        deleteAccountBtn.addEventListener('click', function (event) {
            event.preventDefault();
            deleteAccount();
        });
    }
}

// function to delete account
function deleteAccount() {
    fetch('/csrf-token')
        .then(response => response.json())
        .then(data => {
            const csrfToken = data.csrfToken; // set the csrf token value

            if (confirm('are you sure you want to delete your account? this action cannot be undone.')) {
                fetch('/api/user', {
                    method: 'DELETE',
                    headers: {
                        'Content-Type': 'application/json',
                        'CSRF-Token': csrfToken
                    }
                })
                .then(response => response.json())
                .then(data => {
                    console.log('account deletion requested:', data);
                    if (data.success) {
                        alert('account deleted successfully');
                        window.location.href = '/';
                    } else {
                        alert('failed to delete account: ' + data.message);
                    }
                })
                .catch(error => {
                    console.error('error requesting account deletion:', error);
                    alert('failed to delete account');
                });
            }
        })
        .catch(error => {
            console.error('error fetching csrf token:', error);
        });
}
