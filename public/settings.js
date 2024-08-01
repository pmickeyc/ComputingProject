/*
Author: Padraig McCauley - 20123744
BiggerPhish Educational Platform
Computing Project (BSCCYBE4)
Due: 05/8/2024
*/

// Add event listener for when the document is fully loaded
document.addEventListener('DOMContentLoaded', function () {
    fetchUserData(); // Fetch user data

    setupEditDetailsButton(); // Setup edit details button
    setupUpdateEmailButton(); // Setup update email button
    setupUpdatePasswordButton(); // Setup update password button
    setupUpdateNameButton(); // Setup update name button
    setupDeleteAccountButton(); // Setup delete account button
});

// Function to fetch user data
function fetchUserData() {
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
}

// Function to setup edit details button
function setupEditDetailsButton() {
    var editBtn = document.getElementById('edit-details-btn');
    if (editBtn) {
        editBtn.addEventListener('click', toggleEditMode);
    }
}

// Function to toggle edit mode
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

// Function to setup update email button
function setupUpdateEmailButton() {
    var updateEmailBtn = document.getElementById('update-email-btn');
    if (updateEmailBtn) {
        updateEmailBtn.addEventListener('click', function (event) {
            event.preventDefault();
            updateEmail();
        });
    }
}

// Function to update email
function updateEmail() {
    fetch('/csrf-token')
        .then(response => response.json())
        .then(data => {
            const csrfToken = data.csrfToken; // Set the CSRF token value
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
            .then(response => response.json().then(data => ({ status: response.status, body: data }))) // Parse both status and body
            .then(({ status, body }) => {
                if (status === 200) {
                    alert(body.message);
                    location.reload(); // Reload the page
                } else {
                    alert('Failed to update email: ' + body.message);
                }
            })
            .catch(error => {
                console.error('Error updating email:', error);
                alert('Failed to update email due to network error.');
            });
        })
        .catch(error => {
            console.error('Error fetching CSRF token:', error);
        });
}

// Function to setup update password button
function setupUpdatePasswordButton() {
    var updatePasswordBtn = document.getElementById('update-password-btn');
    if (updatePasswordBtn) {
        updatePasswordBtn.addEventListener('click', function (event) {
            event.preventDefault();
            clearPasswordFields();
            $('#passwordModal').modal('show');
            removeReadOnlyAttributes(); // Remove readonly attributes when the modal is shown
        });
    }

    var updatePasswordButton = document.getElementById('update-password-button');
    if (updatePasswordButton) {
        //console.log('Setting up update password button click...');
        updatePasswordButton.addEventListener('click', function (event) {
            event.preventDefault();
            updatePassword();
        });
    }
}

// Function to clear password fields
function clearPasswordFields() {
    document.getElementById('new-password').value = '';
    document.getElementById('confirm-new-password').value = '';
}

// Function to remove readonly attributes
function removeReadOnlyAttributes() {
    document.getElementById('new-password').removeAttribute('readonly');
    document.getElementById('confirm-new-password').removeAttribute('readonly');
}

// Function to update password
function updatePassword() {
    //console.log('Starting password update process...');
    //console.log(email);
    fetch('/csrf-token')
        .then(response => response.json())
        .then(data => {
            const csrfToken = data.csrfToken; // Set the CSRF token value

            var newPassword = document.getElementById('new-password').value;
            var confirmNewPassword = document.getElementById('confirm-new-password').value;



            if (!newPassword || !confirmNewPassword) {
                alert("All fields are required.");
                return;
            }

            if (newPassword !== confirmNewPassword) {
                alert("The new passwords do not match.");
                return;
            }

            const requestBody = {
                email: email,
                newPassword: newPassword
            };

            fetch('/update-user-password', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'CSRF-Token': csrfToken
                },
                body: JSON.stringify(requestBody)
            })
            .then(response => {
                //console.log('Password update response status:', response.status);
                if (!response.ok) {
                    throw new Error(`Network response was not ok: ${response.statusText}`);
                }
                return response.json();
            })
            .then(data => {
                //console.log('Password update response data:', data);
                if (data.success) {
                    alert('Password updated successfully');
                    console.log('Password updated successfully');
                     location.reload();
                     $('#passwordModal').modal('hide');
                } else {
                    alert('Failed to update password: ' + data.message);
                    console.log('Password update failed:', data.message);
                }
            })
            .catch(error => {
                console.error('Error updating password:', error);
            });
        })
        .catch(error => {
            console.error('Error fetching CSRF token:', error);
        });
}


// Function to setup update name button
function setupUpdateNameButton() {
    var updateNameBtn = document.getElementById('update-name-btn');
    if (updateNameBtn) {
        updateNameBtn.addEventListener('click', function (event) {
            event.preventDefault();
            updateName();
        });
    }
}

// Function to update name
function updateName() {
    fetch('/csrf-token')
        .then(response => response.json())
        .then(data => {
            const csrfToken = data.csrfToken; // Set the CSRF token value

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
        })
        .catch(error => {
            console.error('Error fetching CSRF token:', error);
        });
}

// Function to setup delete account button
function setupDeleteAccountButton() {
    var deleteAccountBtn = document.getElementById('delete-account-btn');
    if (deleteAccountBtn) {
        deleteAccountBtn.addEventListener('click', function (event) {
            event.preventDefault();
            deleteAccount();
        });
    }
}

// Function to delete account
function deleteAccount() {
    fetch('/csrf-token')
        .then(response => response.json())
        .then(data => {
            const csrfToken = data.csrfToken; // Set the CSRF token value

            if (confirm('Are you sure you want to delete your account? This action cannot be undone.')) {
                fetch('/api/user', {
                    method: 'DELETE',
                    headers: {
                        'Content-Type': 'application/json',
                        'CSRF-Token': csrfToken
                    }
                })
                .then(response => response.json())
                .then(data => {
                    console.log('Account deletion requested:', data);
                    if (data.success) {
                        alert('Account deleted successfully');
                        window.location.href = '/';
                    } else {
                        alert('Failed to delete account: ' + data.message);
                    }
                })
                .catch(error => {
                    console.error('Error requesting account deletion:', error);
                    alert('Failed to delete account');
                });
            }
        })
        .catch(error => {
            console.error('Error fetching CSRF token:', error);
        });
}
