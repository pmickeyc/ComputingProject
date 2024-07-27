// add event listener for when the document is fully loaded
document.addEventListener('DOMContentLoaded', function () {
    // get logout link element
    const logoutLink = document.getElementById('logout-link');
    if (logoutLink) {
        // add click event listener to logout link
        logoutLink.addEventListener('click', function (e) {
            e.preventDefault();

            // fetch csrf token
            fetch('/csrf-token')
                .then(response => response.json())
                .then(data => {
                    console.log(data);
                    const csrfToken = data.csrfToken; // set the csrf token value

                    // proceed with logout only after fetching the csrf token
                    return fetch('/logout', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'CSRF-Token': csrfToken // include csrf token in the headers
                        },
                    });
                })
                .then(response => {
                    if (!response.ok) {
                        throw new Error('logout failed');
                    }
                    // redirect or reload page
                    window.location.href = '/';
                })
                .catch(error => {
                    console.error('failed to logout', error);
                });
        });
    }
});
