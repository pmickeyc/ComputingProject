document.addEventListener('DOMContentLoaded', function() {
    // Fetch user-specific data from the server
    fetch('/user-data')
    .then(response => response.json())
    .then(data => {
        // Populate user data on the page TDC
    })
    .catch(error => {
        console.error('Error:', error);
    });

    document.getElementById('logout-link').addEventListener('click', function(e) {
        e.preventDefault();
      
        fetch('/logout', {
          method: 'POST',

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
      
});
