/*
Author: Padraig McCauley - 20123744
BiggerPhish Educational Platform
Computing Project (BSCCYBE4)
Due: 05/8/2024

*/

// add event listener for when the document is fully loaded
document.addEventListener('DOMContentLoaded', function () {
    // fetch all users
    fetchAllUsers();

    // add click event listener to submit edit user button
    document.getElementById('submit-edit-user-btn').addEventListener('click', function (event) {
        event.preventDefault();
        submitEditUser();
    });
});

// function to fetch all users
function fetchAllUsers() {
    fetch('/api/admin/all-users')
        .then(response => response.json())
        .then(data => {
            // populate users in the container
            populateUsers(data, '#admin-users-container');
        })
        .catch(error => {
            console.error('error fetching all users for admin:', error);
            document.querySelector('#admin-users-container').innerHTML = '<p class="text-danger">failed to load users.</p>';
        });
}

// function to populate users in a container
function populateUsers(users, containerSelector) {
    const container = document.querySelector(containerSelector);
    container.innerHTML = ''; // clear previous entries
    // iterate over users array
    users.forEach(user => {
        const userElement = document.createElement('div');
        userElement.className = 'col-md-4';
        userElement.innerHTML = `
            <div class="user-tile">
                <h4>${user['User-FName']}</h4> <!-- adjusted for potentially correct property names -->
                <p>Email: ${user['User-Email']}</p> <!-- adjusted for potentially correct property names -->
                <button class="btn btn-secondary edit-user-btn" data-user-id="${user['User-ID']}">Edit</button>
                <button class="btn btn-danger delete-user-btn" data-user-id="${user['User-ID']}">Delete</button>
            </div>
        `;
        // append user element to container
        container.appendChild(userElement);
    });

    // add click event listeners to edit buttons
    document.querySelectorAll('.edit-user-btn').forEach(button => {
        button.addEventListener('click', function () {
            editUser(this.getAttribute('data-user-id'));
        });
    });

    // add click event listeners to delete buttons
    document.querySelectorAll('.delete-user-btn').forEach(button => {
        button.addEventListener('click', function () {
            deleteUser(this.getAttribute('data-user-id'));
        });
    });
}

// function to edit a user
function editUser(userId) {
    fetch(`/api/user/${userId}`)
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                const user = data.user;
                // populate edit user form with user data
                document.getElementById('edit-user-id').value = user['User-ID'];
                document.getElementById('edit-user-name').value = user['User-FName'];
                document.getElementById('edit-user-email').value = user['User-Email'];
                $('#editUserModal').modal('show');
            } else {
                alert('failed to load user data.');
            }
        })
        .catch(error => {
            console.error('error fetching user data:', error);
            alert('failed to load user data.');
        });
}

// function to submit edited user data
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
                    alert('user updated successfully');
                    $('#editUserModal').modal('hide');
                    fetchAllUsers(); // refresh the user list
                } else {
                    alert('failed to update user: ' + data.message);
                }
            })
            .catch(error => {
                console.error('error updating user:', error);
                alert('failed to update user.');
            });
        })
        .catch(error => {
            console.error('error fetching csrf token:', error);
        });
}

// function to delete a user
function deleteUser(userId) {
    if (!confirm('are you sure you want to delete this user?')) {
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
                    alert('user deleted successfully');
                    fetchAllUsers(); // refresh the user list
                } else {
                    alert('failed to delete user: ' + data.message);
                }
            })
            .catch(error => {
                console.error('error deleting user:', error);
                alert('failed to delete user.');
            });
        })
        .catch(error => {
            console.error('error fetching csrf token:', error);
        });
}
