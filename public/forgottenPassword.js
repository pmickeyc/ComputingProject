/*
Author: Padraig McCauley - 20123744
BiggerPhish Educational Platform
Computing Project (BSCCYBE4)
Due: 05/8/2024

*/

// add event listener for when the document is fully loaded
document.addEventListener('DOMContentLoaded', function() {
    // add submit event listener to the forgotten password form
    document.getElementById('forgotten-password-form').addEventListener('submit', function(event) {
        event.preventDefault();

        const email = document.getElementById('inputEmail').value;

        // fetch csrf token
        fetch('/csrf-token')
        .then(response => response.json())
        .then(data => {
            console.log(data);
            document.getElementById('csrf-token').value = data.csrfToken; // set the csrf token value

            // send reset link with csrf token
            fetch('/send-reset-link', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'CSRF-Token': data.csrfToken // include csrf token in the headers
                },
                body: JSON.stringify({ email: email })
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    alert('a temporary password has been sent to your email address.');
                    window.location.href = '/login'; // redirect to the login page
                } else {
                    alert('there was an error sending the temporary password. please try again.');
                }
            })
            .catch(error => {
                console.error('error:', error);
                alert('there was an error sending the temporary password. please try again.');
            });
        })
        .catch(error => console.error('error fetching csrf token:', error));
    });
});
