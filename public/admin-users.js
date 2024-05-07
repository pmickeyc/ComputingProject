document.addEventListener('DOMContentLoaded', function () {
    fetchAllUsers();
});

function fetchAllUsers() {
    fetch('/api/admin/all-users')
        .then(response => response.json())
        .then(data => {
            populateUsers(data, '#admin-users-container');
            console.log(data);
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
                <button onclick="editUser(${user['User-ID']})" class="btn btn-secondary">Edit</button>
                <button onclick="deleteUser(${user['User-ID']})" class="btn btn-danger">Delete</button>
            </div>
        `;
        container.appendChild(userElement);
    });
}

function editUser(userId) {
    console.log('Editing user', userId);
    // Placeholder for actual implementation
}

function deleteUser(userId) {
    console.log('Deleting user', userId);
    // Placeholder for actual implementation
}
