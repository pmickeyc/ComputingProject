document.addEventListener('DOMContentLoaded', function() {
    const registerForm = document.getElementById('register-form');

    if (!registerForm) {
        console.error("Error: Couldn't find the register form element.");
        return;
    }

    registerForm.addEventListener('submit', function(e) {
        e.preventDefault();

        const inputFullName = document.getElementById('inputFullName');
        const inputEmail = document.getElementById('inputEmail');
        const inputPassword = document.getElementById('inputPassword');
        const inputConfirmPassword = document.getElementById('inputConfirmPassword');

        // Check if all fields are filled
        if (!inputFullName.value || !inputEmail.value || !inputPassword.value || !inputConfirmPassword.value) {
            alert('Please fill in all fields.');
            return;
        }

        // Check if passwords match
        if (inputPassword.value !== inputConfirmPassword.value) {
            alert('Passwords do not match.');
            return;
        }

        // Email validation regex
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(inputEmail.value)) {
            alert('Please enter a valid email address.');
            return;
        }

        const formData = {
            firstName: inputFullName.value,
            email: inputEmail.value,
            password: inputPassword.value,
        };

        console.log("Form data:", formData);

        fetch('/register-user', {
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
                window.location.href = '/login.html';
            } else {
                alert('Registration failed: ' + data.message);
            }
        })
        .catch(error => {
            console.error('Error:', error);
            alert('Error: Failed to register. Please try again later.');
        });
    });
});
