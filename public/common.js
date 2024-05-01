document.addEventListener('DOMContentLoaded', function() {
    const logoutLink = document.getElementById('logout-link');
    if (logoutLink) {
        logoutLink.addEventListener('click', function(e) {
            e.preventDefault();

            fetch('/logout', {
                method: 'POST'
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
