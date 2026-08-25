from allauth.socialaccount.adapter import DefaultSocialAccountAdapter


class SocialAccountAdapter(DefaultSocialAccountAdapter):
    """Sign in with Microsoft creates a local user automatically — there's
    no separate local registration flow, so there's nothing to confirm."""

    def is_auto_signup_allowed(self, request, sociallogin):
        return True
