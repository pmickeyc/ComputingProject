// add event listener for when the document is fully loaded
document.addEventListener('DOMContentLoaded', function() {
    const registerForm = document.getElementById('register-form'); // get the register form element

    if (!registerForm) {
        console.error("error: couldn't find the register form element.");
        return;
    }

    // fetch csrf token
    fetch('/csrf-token')
        .then(response => response.json())
        .then(data => {
            console.log(data);
            document.getElementById('csrf-token').value = data.csrfToken; // set the csrf token value
        })
        .catch(error => console.error('error fetching csrf token:', error));

    // add submit event listener to the register form
    registerForm.addEventListener('submit', function(e) {
        e.preventDefault();

        const inputFullName = document.getElementById('inputFullName');
        const inputEmail = document.getElementById('inputEmail');
        const inputPassword = document.getElementById('inputPassword');
        const inputConfirmPassword = document.getElementById('inputConfirmPassword');
        const csrfToken = document.getElementById('csrf-token').value; // get the csrf token value

        // check if all fields are filled
        if (!inputFullName.value || !inputEmail.value || !inputPassword.value || !inputConfirmPassword.value || !csrfToken) {
            alert('please fill in all fields.');
            return;
        }

        // check if passwords match
        if (inputPassword.value !== inputConfirmPassword.value) {
            alert('passwords do not match.');
            return;
        }

        // email validation regex
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(inputEmail.value)) {
            alert('please enter a valid email address.');
            return;
        }

        const formData = {
            firstName: inputFullName.value,
            email: inputEmail.value,
            password: inputPassword.value,
        };

        console.log("form data:", formData);

        // send registration request
        fetch('/register-user', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'CSRF-Token': csrfToken // include csrf token in the headers
            },
            body: JSON.stringify(formData),
        })
        .then(response => {
            if (!response.ok) {
                throw new Error('network response was not ok');
            }
            return response.json();
        })
        .then(data => {
            console.log("server response:", data);
            if (data.success) {
                window.location.href = '/login.html';
            } else {
                alert('registration failed: ' + data.message);
            }
        })
        .catch(error => {
            console.error('error:', error);
            alert('error: failed to register. please try again later.');
        });
    });
});
