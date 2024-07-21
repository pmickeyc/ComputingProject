document.addEventListener('DOMContentLoaded', function () {
    fetchAllUsers();

    document.getElementById('submit-edit-user-btn').addEventListener('click', function (event) {
        event.preventDefault();
        submitEditUser();
    });
});

function fetchAllUsers() {
    fetch('/api/admin/all-users')
        .then(response => response.json())
        .then(data => {
            populateUsers(data, '#admin-users-container');
        })
        .catch(error => {
            console.error('Error fetching all users for admin:', error);
            document.querySelector('#admin-users-container').innerHTML = '<p class="text-danger">Failed to load users.</p>';
        });
}

function populateUsers(users, containerSelector) {
    const container = document.querySelector(containerSelector);
    container.innerHTML = ''; // Clear previous entries
    users.forEach(user => {
        const userElement = document.createElement('div');
        userElement.className = 'col-md-4';
        userElement.innerHTML = `
            <div class="user-tile">
                <h4>${user['User-FName']}</h4> <!-- Adjusted for potentially correct property names -->
                <p>Email: ${user['User-Email']}</p> <!-- Adjusted for potentially correct property names -->
                <button class="btn btn-secondary edit-user-btn" data-user-id="${user['User-ID']}">Edit</button>
                <button class="btn btn-danger delete-user-btn" data-user-id="${user['User-ID']}">Delete</button>
            </div>
        `;
        container.appendChild(userElement);
    });

    document.querySelectorAll('.edit-user-btn').forEach(button => {
        button.addEventListener('click', function () {
            editUser(this.getAttribute('data-user-id'));
        });
    });

    document.querySelectorAll('.delete-user-btn').forEach(button => {
        button.addEventListener('click', function () {
            deleteUser(this.getAttribute('data-user-id'));
        });
    });
}

function editUser(userId) {
    fetch(`/api/user/${userId}`)
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                const user = data.user;
                document.getElementById('edit-user-id').value = user['User-ID'];
                document.getElementById('edit-user-name').value = user['User-FName'];
                document.getElementById('edit-user-email').value = user['User-Email'];
                $('#editUserModal').modal('show');
            } else {
                alert('Failed to load user data.');
            }
        })
        .catch(error => {
            console.error('Error fetching user data:', error);
            alert('Failed to load user data.');
        });
}

function submitEditUser() {
    const userId = document.getElementById('edit-user-id').value;
    const userName = document.getElementById('edit-user-name').value;
    const userEmail = document.getElementById('edit-user-email').value;

    const userData = {
        firstName: userName,
        email: userEmail
    };

    fetch('/csrf-token')
        .then(response => response.json())
        .then(data => {
            const csrfToken = data.csrfToken;

            fetch(`/api/user/${userId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'CSRF-Token': csrfToken
                },
                body: JSON.stringify(userData)
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    alert('User updated successfully');
                    $('#editUserModal').modal('hide');
                    fetchAllUsers(); // Refresh the user list
                } else {
                    alert('Failed to update user: ' + data.message);
                }
            })
            .catch(error => {
                console.error('Error updating user:', error);
                alert('Failed to update user.');
            });
        })
        .catch(error => {
            console.error('Error fetching CSRF token:', error);
        });
}

function deleteUser(userId) {
    if (!confirm('Are you sure you want to delete this user?')) {
        return;
    }

    fetch('/csrf-token')
        .then(response => response.json())
        .then(data => {
            const csrfToken = data.csrfToken;

            fetch(`/api/user/${userId}`, {
                method: 'DELETE',
                headers: {
                    'CSRF-Token': csrfToken
                }
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    alert('User deleted successfully');
                    fetchAllUsers(); // Refresh the user list
                } else {
                    alert('Failed to delete user: ' + data.message);
                }
            })
            .catch(error => {
                console.error('Error deleting user:', error);
                alert('Failed to delete user.');
            });
        })
        .catch(error => {
            console.error('Error fetching CSRF token:', error);
        });
}
