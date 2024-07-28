/*
Author: Padraig McCauley - 20123744
BiggerPhish Educational Platform
Computing Project (BSCCYBE4)
Due: 05/8/2024

*/

// add event listener for when the document is fully loaded
document.addEventListener('DOMContentLoaded', function() {
    const loginForm = document.getElementById('login-form'); // get the login form element

    if (!loginForm) {
        console.error("error: couldn't find the login form element.");
        return;
    }

    // fetch csrf token
    fetch('/csrf-token')
        .then(response => response.json())
        .then(data => {
            // set the csrf token value
            document.getElementById('csrf-token').value = data.csrfToken;
        })
        .catch(error => console.error('error fetching csrf token:', error));

    // add submit event listener to the login form
    loginForm.addEventListener('submit', function(e) {
        e.preventDefault();
        const email = document.getElementById('inputEmail').value;
        const password = document.getElementById('inputPassword').value;
        const csrfToken = document.getElementById('csrf-token').value; // get the csrf token value

        if (!email || !password || !csrfToken) {
            console.error("error: email, password, or csrf token is missing.");
            return;
        }

        const formData = {
            email: email,
            password: password
        };

        // send login request
        fetch('/login-user', {
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
            if (data.success) {
                window.location.href = '/';
            } else {
                alert('login failed: ' + data.message);
            }
        })
        .catch(error => {
            console.error('error:', error);
            alert('error: failed to login. please try again later.');
        });
    });

    // add click event listener to the forgot password link
    const forgotPasswordLink = document.getElementById('forgot-password-link');
    forgotPasswordLink.addEventListener('click', function(e) {
        e.preventDefault();
        window.location.href = '/forgottenPassword';
    });
});
