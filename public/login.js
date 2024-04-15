document.addEventListener('DOMContentLoaded', function() {
    const loginForm = document.getElementById('login-form');

    if (!loginForm) {
        console.error("Error: Couldn't find the login form element.");
        return;
    }

    loginForm.addEventListener('submit', function(e) {
        e.preventDefault();

        const email = document.getElementById('inputEmail').value;
        const password = document.getElementById('inputPassword').value;

        if (!email || !password) {
            console.error("Error: Email or password is missing.");
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
            console.log("Server response:", data);
            if (data.success) {
                // Handle successful login 
                window.location.href = '/';
            } else {
                // Handle login errors 
                alert('Login failed: ' + data.message);
            }
        })
        .catch(error => {
            // Handle errors in sending request
            console.error('Error:', error);
            alert('Error: Failed to login. Please try again later.');
        });
    });
});
