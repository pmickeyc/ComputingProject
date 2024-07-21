document.addEventListener('DOMContentLoaded', function() {
    document.getElementById('forgotten-password-form').addEventListener('submit', function(event) {
        event.preventDefault();

        const email = document.getElementById('inputEmail').value;

        fetch('/csrf-token')
        .then(response => response.json())
        .then(data => {
            console.log(data);
            document.getElementById('csrf-token').value = data.csrfToken; // Set the CSRF token value
        })
        .catch(error => console.error('Error fetching CSRF token:', error));

        fetch('/send-reset-link', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'CSRF-Token': csrfToken // Include CSRF token in the headers
            },
            body: JSON.stringify({ email: email })
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                alert('A temporary password has been sent to your email address.');
                window.location.href = '/login'; // Redirect to the login page
            } else {
                alert('There was an error sending the temporary password. Please try again.');
            }
        })
        .catch(error => {
            console.error('Error:', error);
            alert('There was an error sending the temporary password. Please try again.');
        });
    });
});
