document.addEventListener('DOMContentLoaded', function() {
    document.getElementById('forgotten-password-form').addEventListener('submit', function(event) {
        event.preventDefault();

        const email = document.getElementById('inputEmail').value;

        fetch('/send-reset-link', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
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
