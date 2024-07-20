document.addEventListener('DOMContentLoaded', function () {
    fetchUserData();

    setupEditDetailsButton();
    setupUpdateEmailButton();
    setupUpdatePasswordButton();
    setupUpdateNameButton();
    setupDeleteAccountButton();
});

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

function setupEditDetailsButton() {
    var editBtn = document.getElementById('edit-details-btn');
    if (editBtn) {
        editBtn.addEventListener('click', toggleEditMode);
    }
}

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

function setupUpdateEmailButton() {
    var updateEmailBtn = document.getElementById('update-email-btn');
    if (updateEmailBtn) {
        updateEmailBtn.addEventListener('click', function (event) {
            event.preventDefault();
            updateEmail();
        });
    }
}

function updateEmail() {
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
    .then(response => response.json().then(data => ({status: response.status, body: data}))) // Parse both status and body
    .then(({status, body}) => {
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
}


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

    var passwordForm = document.getElementById('password-form');
    if (passwordForm) {
        passwordForm.addEventListener('submit', function (event) {
            event.preventDefault();
            updatePassword();
        });
    }
}

function clearPasswordFields() {
    document.getElementById('current-password').value = '';
    document.getElementById('new-password').value = '';
    document.getElementById('confirm-new-password').value = '';
}

function removeReadOnlyAttributes() {
    document.getElementById('current-password').removeAttribute('readonly');
    document.getElementById('new-password').removeAttribute('readonly');
    document.getElementById('confirm-new-password').removeAttribute('readonly');
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
                $('#passwordModal').modal('hide');
            } else {
                alert('Failed to update password: ' + data.message);
            }
        })
        .catch(error => {
            console.error('Error updating password:', error);
        });
}

function setupUpdateNameButton() {
    var updateNameBtn = document.getElementById('update-name-btn');
    if (updateNameBtn) {
        updateNameBtn.addEventListener('click', function (event) {
            event.preventDefault();
            updateName();
        });
    }
}

function updateName() {
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
}

function setupDeleteAccountButton() {
    var deleteAccountBtn = document.getElementById('delete-account-btn');
    if (deleteAccountBtn) {
        deleteAccountBtn.addEventListener('click', function (event) {
            event.preventDefault();
            deleteAccount();
        });
    }
}

function deleteAccount() {
    if (confirm('Are you sure you want to delete your account? This action cannot be undone.')) {
        fetch('/api/user', {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json'
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
}

