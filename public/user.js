document.addEventListener('DOMContentLoaded', function() {
  fetch('/user-data')
  .then(response => response.json())
  .then(data => {
    console.log(data);
      document.getElementById('user-name').textContent = data['User-FName']; // Assuming FirstName is a field in your data
      // Populate other user-specific data as needed
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
