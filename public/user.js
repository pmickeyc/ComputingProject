document.addEventListener('DOMContentLoaded', function () {
  fetch('/user-data')
    .then(response => response.json())
    .then(data => {
      //console.log(data);
      document.getElementById('user-name').textContent = data['User-FName'];
    })
    .catch(error => {
      console.error('Error:', error);
    });

});