document.addEventListener('DOMContentLoaded', function () {
    const logoutLink = document.getElementById('logout-link');
    if (logoutLink) {
        logoutLink.addEventListener('click', function (e) {
            e.preventDefault();

            // Fetch CSRF token
            fetch('/csrf-token')
                .then(response => response.json())
                .then(data => {
                    console.log(data);
                    const csrfToken = data.csrfToken; // Set the CSRF token value

                    // Proceed with logout only after fetching the CSRF token
                    return fetch('/logout', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'CSRF-Token': csrfToken // Include CSRF token in the headers
                        },
                    });
                })
                .then(response => {
                    if (!response.ok) {
                        throw new Error('Logout failed');
                    }
                    // Redirect or reload page
                    window.location.href = '/';
                })
                .catch(error => {
                    console.error('Failed to logout', error);
                });
        });
    }
});
