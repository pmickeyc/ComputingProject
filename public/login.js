document.addEventListener('DOMContentLoaded', function() {
    const loginForm = document.getElementById('login-form');

    if (!loginForm) {
        console.error("Error: Couldn't find the login form element.");
        return;
    }

    fetch('/csrf-token')
        .then(response => response.json())
        .then(data => {
            //console.log(data);
            document.getElementById('csrf-token').value = data.csrfToken; // Set the CSRF token value
        })
        .catch(error => console.error('Error fetching CSRF token:', error));

    loginForm.addEventListener('submit', function(e) {
        e.preventDefault();
        const email = document.getElementById('inputEmail').value;
        const password = document.getElementById('inputPassword').value;
        const csrfToken = document.getElementById('csrf-token').value; // Get the CSRF token value

        if (!email || !password || !csrfToken) {
            console.error("Error: Email, password, or CSRF token is missing.");
            return;
        }

        const formData = {
            email: email,
            password: password
        };

        fetch('/login-user', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'CSRF-Token': csrfToken // Include CSRF token in the headers
            },
            body: JSON.stringify(formData),
        })
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            return response.json();
        })
        .then(data => {
            //console.log("Server response:", data);
            if (data.success) {
                window.location.href = '/';
            } else {
                alert('Login failed: ' + data.message);
            }
        })
        .catch(error => {
            console.error('Error:', error);
            alert('Error: Failed to login. Please try again later.');
        });
    });

    const forgotPasswordLink = document.getElementById('forgot-password-link');
    forgotPasswordLink.addEventListener('click', function(e) {
        e.preventDefault();
        window.location.href = '/forgottenPassword';
    });
});
