const { Requester, Validator } = require('@chainlink/external-adapter')
const axios = require('axios');

// Define custom error scenarios for the API.
// Return true for the adapter to retry.
const customError = (data) => {
  if (data.Response === 'Error') return true
  return false
}

// Define custom parameters to be used by the adapter.
// Extra parameters can be stated in the extra object,
// with a Boolean value indicating whether or not they
// should be required.

const customParams = {
  action: ['action'],
  sender: false,
  login: false,
  to_id: false,
}

const createRequest = (input, callback) => {
  // The Validator helps you validate the Chainlink request data
  const validator = new Validator(callback, input, customParams)
  const jobRunID = validator.validated.id

  const action = validator.validated.data.action;

  var getTokenConfig = {
    url: 'https://id.twitch.tv/oauth2/token',
    method: 'POST',
    params: {
      client_id: process.env.TWITCH_API_KEY,
      client_secret: process.env.TWITCH_API_SECRET,
      grant_type: 'client_credentials'
    }
  }

  var accessToken = 'failed to get token';
  const td = axios.request(getTokenConfig)
  .then((response) => {

    accessToken = response.data.access_token

    if (action == "verify" || action == "name" || action == "pic")
    {

      const url = "https://api.twitch.tv/helix/users"

      const login = validator.validated.data.login || "login"

      const params = {
        login
      }

      const config = {
        url,
        params,
        method: "GET",
        headers: {
          "Client-ID": process.env.TWITCH_API_KEY,
          'Authorization': 'Bearer ' + accessToken
        }
      }

      Requester.request(config, customError)
        .then(response => {

          // A quick fix around the Twitch api's data container
          var fixed = JSON.stringify(response.data);
          fixed = fixed.replace('[', '');
          fixed = fixed.replace(']', '');
          response.data = JSON.parse(fixed);

          console.log(response.data);

          if (action == "verify")
          {
            response.data.result = response.data.data.description.toLowerCase();
          }
          else if (action == "name")
          {
            response.data.result = response.data.data.login;
          }
          else if (action == "pic")
          {
            var image = response.data.data.profile_image_url.toString();
            image = image.replace('https://static-cdn.jtvnw.net/jtv_user_pictures/', '');
            image = image.replace('-profile_image-300x300.jpg', '');
            image = image.replace('-','');
            image = image.replace('-','');
            image = image.replace('-','');
            image = image.replace('-','');
            response.data.result = image;
          }

          console.log(response.data.data.profile_image_url);
          console.log(response.data.result);

          response.status = 200;
          callback(response.status, Requester.success(jobRunID, response));
        })
        .catch(error => {
          callback(500, Requester.errored(jobRunID, error))
        })
    }
    else if (action == "register")
    {
      const url = "https://api.twitch.tv/helix/users"

      const login = validator.validated.data.login || "login"

      const params = {
        login
      }

      const config = {
        url,
        params,
        method: "GET",
        headers: {
          "Client-ID": process.env.TWITCH_API_KEY,
          'Authorization': 'Bearer ' + accessToken
        }
      }

      Requester.request(config, customError)
        .then(response => {

          // A quick fix around the Twitch api's data container
          var fixed = JSON.stringify(response.data);
          fixed = fixed.replace('[', '');
          fixed = fixed.replace(']', '');
          response.data = JSON.parse(fixed);

          response.data.result = response.data.data.id;
          response.status = 200;
          callback(response.status, Requester.success(jobRunID, response));
        })
        .catch(error => {
          callback(500, Requester.errored(jobRunID, error))
        })
    }
    else if (action == "follows")
    {

      // Perform another request to get current follower count
      const to_id = validator.validated.data.to_id || "0"

      const url = "https://api.twitch.tv/helix/users/follows"
      const params = {
        to_id
      }

      const config = {
        url,
        params,
        method: "GET",
        headers: {
          "Client-ID": process.env.TWITCH_API_KEY,
          'Authorization': 'Bearer ' + accessToken
        }
      }

      Requester.request(config, customError)
        .then(response => {

          response.data.result = Requester.validateResultNumber(response.data, ['total']);
          response.status = 200;
          callback(response.status, Requester.success(jobRunID, response));

        }).catch(error => {
          callback(500, Requester.errored(jobRunID, error))
        });

      }

    else if (action == "demo")
    {
      var url = "https://api.twitch.tv/helix/users";

      const login = validator.validated.data.login || "login"

      var params = {
        login
      }

      var config = {
        url,
        params,
        method: "GET",
        headers: {
          "Client-ID": process.env.TWITCH_API_KEY,
          'Authorization': 'Bearer ' + accessToken
        }
      }

      Requester.request(config, customError)
        .then(response => {

          // A quick fix around the Twitch api's data container
          var fixed = JSON.stringify(response.data);
          fixed = fixed.replace('[', '');
          fixed = fixed.replace(']', '');
          response.data = JSON.parse(fixed);

          const to_id = String(response.data.data.id);
          //console.log(to_id);

          // Perform another request to get current follower count
          url = "https://api.twitch.tv/helix/users/follows";
          params = {
            to_id
          }

          //console.log(url);

          config = {
            url,
            params,
            method: "GET",
            headers: {
              "Client-ID": process.env.TWITCH_API_KEY,
              'Authorization': 'Bearer ' + accessToken
            }
          }

          Requester.request(config, customError)
            .then(response => {

              response.data.result = Requester.validateResultNumber(response.data, ['total']);
              response.status = 200;
              callback(response.status, Requester.success(jobRunID, response));

            }).catch(error => {
              callback(500, Requester.errored(jobRunID, error))
            });

        })
        .catch(error => {
          callback(500, Requester.errored(jobRunID, error))
        })
    }
    else
    {
      callback(response.status, Requester.success(jobRunID, response));
      //callback(500, Requester.errored(jobRunID, "Invalid action"));
    }



  })
  .catch((error) => {
    console.log(error);
  });


}

// This is a wrapper to allow the function to work with
// GCP Functions
exports.gcpservice = (req, res) => {
  createRequest(req.body, (statusCode, data) => {
    res.status(statusCode).send(data)
  })
}

// This is a wrapper to allow the function to work with
// AWS Lambda
exports.handler = (event, context, callback) => {
  createRequest(event, (statusCode, data) => {
    callback(null, data)
  })
}

// This is a wrapper to allow the function to work with
// newer AWS Lambda implementations
exports.handlerv2 = (event, context, callback) => {
  createRequest(JSON.parse(event.body), (statusCode, data) => {
    callback(null, {
      statusCode: statusCode,
      body: JSON.stringify(data),
      isBase64Encoded: false
    })
  })
}

// This allows the function to be exported for testing
// or for running in express
module.exports.createRequest = createRequest
