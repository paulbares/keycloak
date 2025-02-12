import ComponentRepresentation from "@keycloak/keycloak-admin-client/lib/defs/componentRepresentation";
import ComponentTypeRepresentation from "@keycloak/keycloak-admin-client/lib/defs/componentTypeRepresentation";
import {
  ActionGroup,
  Button,
  ButtonVariant,
  DropdownItem,
  FormGroup,
  PageSection,
  ValidatedOptions,
} from "@patternfly/react-core";
import { useState } from "react";
import { FormProvider, useForm, useWatch } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router-dom";
import { HelpItem } from "ui-shared";

import { adminClient } from "../../admin-client";
import { useAlerts } from "../../components/alert/Alerts";
import { useConfirmDialog } from "../../components/confirm-dialog/ConfirmDialog";
import { DynamicComponents } from "../../components/dynamic/DynamicComponents";
import { FormAccess } from "../../components/form/FormAccess";
import { KeycloakSpinner } from "../../components/keycloak-spinner/KeycloakSpinner";
import { KeycloakTextInput } from "../../components/keycloak-text-input/KeycloakTextInput";
import { ViewHeader } from "../../components/view-header/ViewHeader";
import { useRealm } from "../../context/realm-context/RealmContext";
import { useFetch } from "../../utils/useFetch";
import { useParams } from "../../utils/useParams";
import {
  RegistrationProviderParams,
  toRegistrationProvider,
} from "../routes/AddRegistrationProvider";
import { toClientRegistration } from "../routes/ClientRegistration";

export default function DetailProvider() {
  const { t } = useTranslation();
  const { id, providerId, subTab } = useParams<RegistrationProviderParams>();
  const navigate = useNavigate();
  const form = useForm<ComponentRepresentation>({
    defaultValues: { providerId },
  });
  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = form;

  const { realm } = useRealm();
  const { addAlert, addError } = useAlerts();
  const [provider, setProvider] = useState<ComponentTypeRepresentation>();
  const [parentId, setParentId] = useState("");

  useFetch(
    async () =>
      await Promise.all([
        adminClient.realms.getClientRegistrationPolicyProviders({ realm }),
        adminClient.realms.findOne({ realm }),
        id ? adminClient.components.findOne({ id }) : Promise.resolve(),
      ]),
    ([providers, realm, data]) => {
      setProvider(providers.find((p) => p.id === providerId));
      setParentId(realm?.id || "");
      reset(data || { providerId });
    },
    [],
  );

  const providerName = useWatch({ control, defaultValue: "", name: "name" });

  const onSubmit = async (component: ComponentRepresentation) => {
    if (component.config)
      Object.entries(component.config).forEach(
        ([key, value]) =>
          (component.config![key] = Array.isArray(value) ? value : [value]),
      );
    try {
      const updatedComponent = {
        ...component,
        subType: subTab,
        parentId,
        providerType:
          "org.keycloak.services.clientregistration.policy.ClientRegistrationPolicy",
        providerId,
      };
      if (id) {
        await adminClient.components.update({ id }, updatedComponent);
      } else {
        const { id } = await adminClient.components.create(updatedComponent);
        navigate(toRegistrationProvider({ id, realm, subTab, providerId }));
      }
      addAlert(t(`provider${id ? "Updated" : "Create"}Success`));
    } catch (error) {
      addError(`provider${id ? "Updated" : "Create"}Error`, error);
    }
  };

  const [toggleDeleteDialog, DeleteConfirm] = useConfirmDialog({
    titleKey: "clientRegisterPolicyDeleteConfirmTitle",
    messageKey: t("clientRegisterPolicyDeleteConfirm", {
      name: providerName,
    }),
    continueButtonLabel: "delete",
    continueButtonVariant: ButtonVariant.danger,
    onConfirm: async () => {
      try {
        await adminClient.components.del({
          realm,
          id: id!,
        });
        addAlert(t("clientRegisterPolicyDeleteSuccess"));
        navigate(toClientRegistration({ realm, subTab }));
      } catch (error) {
        addError("clientRegisterPolicyDeleteError", error);
      }
    },
  });

  if (!provider) {
    return <KeycloakSpinner />;
  }

  return (
    <>
      <ViewHeader
        titleKey={id ? providerName! : "createPolicy"}
        subKey={id}
        dropdownItems={
          id
            ? [
                <DropdownItem
                  data-testid="delete"
                  key="delete"
                  onClick={toggleDeleteDialog}
                >
                  {t("delete")}
                </DropdownItem>,
              ]
            : undefined
        }
      />
      <DeleteConfirm />
      <PageSection variant="light">
        <FormAccess
          role="manage-clients"
          isHorizontal
          onSubmit={handleSubmit(onSubmit)}
        >
          <FormGroup label={t("provider")} fieldId="provider">
            <KeycloakTextInput
              id="providerId"
              data-testid="providerId"
              {...register("providerId")}
              readOnly
            />
          </FormGroup>
          <FormGroup
            label={t("name")}
            fieldId="kc-name"
            helperTextInvalid={t("required")}
            validated={
              errors.name ? ValidatedOptions.error : ValidatedOptions.default
            }
            labelIcon={
              <HelpItem
                helpText={t("clientPolicyName")}
                fieldLabelId="kc-name"
              />
            }
            isRequired
          >
            <KeycloakTextInput
              id="kc-name"
              data-testid="name"
              validated={
                errors.name ? ValidatedOptions.error : ValidatedOptions.default
              }
              {...register("name", { required: true })}
            />
          </FormGroup>
          <FormProvider {...form}>
            <DynamicComponents properties={provider.properties} />
          </FormProvider>
          <ActionGroup>
            <Button data-testid="save" type="submit">
              {t("save")}
            </Button>
            <Button
              variant="link"
              component={(props) => (
                <Link
                  {...props}
                  to={toClientRegistration({ realm, subTab })}
                ></Link>
              )}
            >
              {t("cancel")}
            </Button>
          </ActionGroup>
        </FormAccess>
      </PageSection>
    </>
  );
}
