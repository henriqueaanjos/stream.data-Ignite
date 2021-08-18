import { makeRedirectUri, revokeAsync, startAsync } from 'expo-auth-session';
import React, { useEffect, createContext, useContext, useState, ReactNode } from 'react';
import { generateRandom } from 'expo-auth-session/build/PKCE';

import { api } from '../services/api';

const  { CLIENT_ID } = process.env;

interface User {
  id: number;
  display_name: string;
  email: string;
  profile_image_url: string;
}

interface AuthContextData {
  user: User;
  isLoggingOut: boolean;
  isLoggingIn: boolean;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
}

interface AuthProviderData {
  children: ReactNode;
}

const AuthContext = createContext({} as AuthContextData);

const twitchEndpoints = {
  authorization: 'https://id.twitch.tv/oauth2/authorize',
  revocation: 'https://id.twitch.tv/oauth2/revoke'
};

function AuthProvider({ children }: AuthProviderData) {
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [user, setUser] = useState({} as User);
  const [userToken, setUserToken] = useState('');

  // get CLIENT_ID from environment variables

  async function signIn() {
    try {
      setIsLoggingIn(true); // set isLoggingIn to true

      const REDIRECT_URI = makeRedirectUri({useProxy: true}); // REDIRECT_URI - create OAuth redirect URI using makeRedirectUri() with "useProxy" option set to true
      const RESPONSE_TYPE =  'token'; // RESPONSE_TYPE - set to "token"
      const SCOPE = encodeURI('openid user:read:email user:read:follows'); // SCOPE - create a space-separated list of the following scopes: "openid", "user:read:email" and "user:read:follows"
      const FORCE_VERIFY = true; // FORCE_VERIFY - set to true
      const STATE = generateRandom(30); // STATE - generate random 30-length string using generateRandom() with "size" set to 30
      
      const authUrl = twitchEndpoints.authorization+`?client_id=${CLIENT_ID}`+ // assemble authUrl with twitchEndpoint authorization, client_id, 
      `&redirect_uri=${REDIRECT_URI}&response_type=${RESPONSE_TYPE}&scope=${SCOPE}`+
      `&force_verify=${FORCE_VERIFY}&state=${STATE}`; // redirect_uri, response_type, scope, force_verify and state

      const authResponse = await startAsync({authUrl});// call startAsync with authUrl

      if(authResponse.type === 'success' && authResponse.params.error != 'access_denied'){ // verify if startAsync response.type equals "success" and response.params.error differs from "access_denied"
      // if true, do the following:
        
        if(authResponse.params.state != STATE){// verify if startAsync response.params.state differs from STATE
        // if true, do the following:
          throw new Error('Invalid state value');// throw an error with message "Invalid state value"
        }
        api.defaults.headers.authorization = `Bearer ${authResponse.params.access_token}`;// add access_token to request's authorization header

        const userResponse = await api.get('/users'); // call Twitch API's users route
        
        setUser(userResponse.data.data[0]); // set user state with response from Twitch API's route "/users"
        setUserToken(authResponse.params.access_token);// set userToken state with response's access_token from startAsync
      }
    } catch (error) {
      // throw an error
      throw new Error(error);
    } finally {
      // set isLoggingIn to false
      setIsLoggingIn(false);
    }
  }

  async function signOut() {
    try {
      setIsLoggingOut(true);// set isLoggingOut to true

      revokeAsync({
        token: userToken,
        clientId: CLIENT_ID
      },{
        revocationEndpoint: twitchEndpoints.revocation
      })// call revokeAsync with access_token, client_id and twitchEndpoint revocation
    } catch (error) {
    } finally {
      setUser({} as User); // set user state to an empty User object
      setUserToken(''); // set userToken state to an empty string
 
      delete api.defaults.headers.authorization; // remove "access_token" from request's authorization header

      setIsLoggingOut(false); // set isLoggingOut to false
    }
  }

  useEffect(() => {
    // add client_id to request's "Client-Id" header
    api.defaults.headers['Client-Id'] = CLIENT_ID;
  }, [])

  return (
    <AuthContext.Provider value={{ user, isLoggingOut, isLoggingIn, signIn, signOut }}>
      { children }
    </AuthContext.Provider>
  )
}

function useAuth() {
  const context = useContext(AuthContext);

  return context;
}

export { AuthProvider, useAuth };
