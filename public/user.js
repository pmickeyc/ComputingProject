// add event listener for when the document is fully loaded
document.addEventListener('DOMContentLoaded', function () {
  // fetch user data from the server
  fetch('/user-data')
    .then(response => response.json())
    .then(data => {
      // display user data
      document.getElementById('user-name').textContent = data['User-FName'];

      // calculate time differences
      const creationDate = new Date(data['Creation-Date']);
      const modifiedDate = new Date(data['Modified-Date']);
      const currentDate = new Date();

      const timeSinceCreated = getTimeDifference(creationDate, currentDate);
      const timeSinceModified = getTimeDifference(modifiedDate, currentDate);

      // display time differences
      document.getElementById('time-since-created').textContent = timeSinceCreated;
      document.getElementById('time-since-modified').textContent = timeSinceModified;
    })
    .catch(error => {
      console.error('error:', error);
    });

  // function to calculate time difference between two dates
  function getTimeDifference(startDate, endDate) {
    const diffInMs = endDate - startDate;
    const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));

    return `${diffInDays} days`;
  }
});
