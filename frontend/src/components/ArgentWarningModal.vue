<template>
  <q-card class="border-top-thick">
    <q-card-section class="row justify-end q-my-none q-py-none">
      <q-btn class="text-caption text-muted" icon="fas fa-times" flat round dense v-close-popup />
    </q-card-section>

    <q-card-section>
      <h5 class="text-bold text-center q-mt-none">
        <q-icon name="fas fa-exclamation-triangle" color="warning" left />Warning for Argent Users!
      </h5>
    </q-card-section>

    <q-card-section>
      Umbra works by generating an app-specific set of keys which are derived from your wallet's private key. Argent is
      unique in that it's security does not rely on your private key, which generally is good!
      <br /><br />
      But when using Umbra, this means you have to be careful, and you should be aware of the following:
      <ol>
        <li>
          If you recover your Argent wallet onto a new device, the new wallet will have the same address but a different
          private key. This means that, unless you still have access to the old device, funds send via Umbra that you
          have not withdraw will become unrecoverable, as the need the original private key
        </li>
        <br />
        <li>
          As a result, when you get a new device, you must repeat the Umbra account setup and re-publish your keys.
          Soon, the app will attempt to detect when you need to do this to minimize the chance of lost funds, but for
          now you must do it mnually
        </li>
        <br />
        <li>
          Unlike other applications, the security of funds received by Umbra is not protected by the standard Argent
          security model, and instead they are just protected by your private key
        </li>
      </ol>
    </q-card-section>

    <q-card-section>
      <div class="row justify-evenly">
        <router-link class="no-text-decoration" target="_blank" to="/faq#receiving-funds">
          <!-- Button does nothing on click, but we wrap with router-link to open the page in a new tab -->
          <base-button label="Learn More" :outline="true" />
        </router-link>
        <base-button label="I acknowledge the risks" @click="context.emit('acknowledged')" />
      </div>
    </q-card-section>
  </q-card>
</template>

<script lang="ts">
import { defineComponent } from '@vue/composition-api';

export default defineComponent({
  name: 'ArgentWarningModal',
  setup(context) {
    return { context };
  },
});
</script>
