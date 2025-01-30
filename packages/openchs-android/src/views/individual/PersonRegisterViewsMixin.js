import TypedTransition from "../../framework/routing/TypedTransition";
import PersonRegisterFormView from "./PersonRegisterFormView";
import {Actions} from "../../action/individual/PersonRegisterActions";
import AbstractDataEntryState from "../../state/AbstractDataEntryState";
import {BaseEntity, WorkItem} from 'avni-models';
import CHSNavigator from "../../utility/CHSNavigator";
import _ from "lodash";

class Mixin {
    static getNextProps(view, popVerificationVew) {
        const phoneNumberObservation = _.find(view.state.individual.observations, obs => obs.isPhoneNumberVerificationRequired(view.state.filteredFormElements));
        return {
            completed: (state, decisions, ruleValidationErrors, checklists, nextScheduledVisits) => {
                const onSaveCallback = ((source) => {
                    const workLists = state.workListState.workLists;
                    const workItem = workLists.getCurrentWorkItem();
                    if (_.includes([WorkItem.type.ADD_MEMBER, WorkItem.type.HOUSEHOLD], workItem.type)) {
                        CHSNavigator.onSaveGoToProgramEnrolmentDashboardView(source, workItem.parameters.member.groupSubject.uuid, "newMemberAddedMsg")
                    } else {
                        CHSNavigator.onSaveGoToProgramEnrolmentDashboardView(source, view.state.individual.uuid);
                    }
                });
                const registrationTitle = view.I18n.t(view.registrationType) + view.I18n.t('registration');
                const headerMessage = `${registrationTitle} - ${view.I18n.t('summaryAndRecommendations')}`;
                CHSNavigator.navigateToSystemsRecommendationView(view, decisions, ruleValidationErrors, state.individual,
                    state.individual.observations, Actions.SAVE, onSaveCallback, headerMessage, null,
                    nextScheduledVisits, state.form, state.workListState, null, state.saveDrafts,
                    popVerificationVew, state.individual.isRejectedEntity(), state.individual.latestEntityApprovalStatus,
                    undefined, state.getAffiliatedGroups());
            },
            movedNext: (state) => {
                if (state.wizard.isFirstFormPage())
                    TypedTransition.from(view).with({}).to(PersonRegisterFormView);
            },
            validationFailed: (newState) => {
                if (AbstractDataEntryState.hasValidationError(view.state, BaseEntity.fieldKeys.EXTERNAL_RULE)) {
                    view.showError(newState.validationResults[0].message);
                }
            },
            popVerificationVewFunc: () => TypedTransition.from(view).popToBookmark(),
            popVerificationVew,
            phoneNumberObservation,
            verifyPhoneNumber: (observation) => CHSNavigator.navigateToPhoneNumberVerificationView(view, this.next.bind(this, view), observation, () => view.dispatchAction(Actions.ON_SUCCESS_OTP_VERIFICATION, {observation}), () => view.dispatchAction(Actions.ON_SKIP_VERIFICATION, {
                observation,
                skipVerification: true
            }))
        }
    }

    static next(view, popVerificationVew) {
        if (view.scrollToTop)
            view.scrollToTop();
        const actionParams = Mixin.getNextProps(view, popVerificationVew);
        view.dispatchAction(Actions.NEXT, _.merge(actionParams, {
            onCompletion: (newState) => {
                view.dispatchAction(Actions.USE_THIS_STATE, {state: newState});
            }
        }));
    }

    static summary(view) {
        const actionParams = Mixin.getNextProps(view, false);
        view.dispatchAction(Actions.SUMMARY_PAGE, _.merge(actionParams, {
            onCompletion: (newState) => {
                view.dispatchAction(Actions.USE_THIS_STATE, {state: newState});
            }
        }));
    }
}

export default Mixin;
