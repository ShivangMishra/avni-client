import BaseService from "./BaseService";
import Service from "../framework/bean/Service";
import {Encounter, Individual, MediaQueue, ProgramEncounter, ProgramEnrolment} from 'avni-models';
import General from "../utility/General";
import _ from 'lodash';
import {get} from '../framework/http/requests';
import RNFetchBlob from 'rn-fetch-blob';
import FileSystem from "../model/FileSystem";
import fs from 'react-native-fs';
import IndividualService from "./IndividualService";
import EncounterService from "./EncounterService";
import ProgramEncounterService from "./program/ProgramEncounterService";
import ProgramEnrolmentService from "./ProgramEnrolmentService";
import * as mime from 'react-native-mime-types';

@Service("mediaQueueService")
class MediaQueueService extends BaseService {
    static DumpType = {
        Catchment: 'catchment',
        Adhoc: 'Adhoc'
    }

    constructor(db, context) {
        super(db, context);
    }

    getSchema() {
        return MediaQueue.schema.name;
    }

    fileExistsInQueue(fileName) {
        return this.getAll().filtered(`fileName == '${fileName}'`).length > 0;
    }

    addToQueue(entity, schemaName, fileName, datatype, entityTargetField = "observations", conceptUUID) {
        //Guard against infinite loop. Uploading MediaQueueItem saves entity with the uploaded url.
        //This will trigger an addToQueue once again.
        const fileHasAlreadyBeenUploaded = _.startsWith(fileName, 'http');
        if (fileHasAlreadyBeenUploaded) {
            General.logDebug("MediaQueueService", `${fileName} has already been uploaded. Ignoring... `);
            return;
        }

        General.logInfo('MediaQueueService', `Adding ${fileName} to queue`);
        if (this.fileExistsInQueue(fileName)) return;
        this.runInTransaction(() => {
            this.db.create(MediaQueue.schema.name,
                MediaQueue.create(entity.uuid, schemaName, fileName, datatype, entityTargetField, conceptUUID));
        });
    }

    addMediaToQueue(entity, schemaName) {
        if(schemaName === Individual.schema.name && !_.isEmpty(entity.getProfilePicture())) {
            this.addToQueue(entity, schemaName, entity.getProfilePicture(), 'Profile-Pics', "profilePicture")
        }
        _.forEach(entity.findMediaObservations(), (observation) => {
            _.forEach(_.flatten([observation.getValue()]), filename => {
                this.addToQueue(entity, schemaName, filename, observation.concept.datatype, "observations", observation.concept.uuid)
            })
        });
    }

    popItem(mediaQueueItem) {
        General.logDebug("MediaQueueService", `Deleting Media QueueItem ${mediaQueueItem.uuid} - ${mediaQueueItem.fileName}`);
        const itemToBeDeleted = this.findByUUID(mediaQueueItem.uuid, MediaQueue.schema.name);
        this.db.write(() => this.db.delete(itemToBeDeleted));
    }

    getDirByType(mediaQueueItem) {
        switch (mediaQueueItem.type) {
            case 'Image':
                return FileSystem.getImagesDir();
            case 'Profile-Pics':
                return FileSystem.getProfilePicsDir();
            case 'Video':
                return FileSystem.getVideosDir();
            case 'Audio':
                return FileSystem.getAudioDir();
            case 'File':
                return FileSystem.getFileDir();
        }
    }

    getAbsoluteFileName(mediaQueueItem) {
        const directory = this.getDirByType(mediaQueueItem);
        return `${directory}/${mediaQueueItem.fileName}`;
    }

    getDumpUploadUrl(dumpType, fileName) {
        if (dumpType === MediaQueueService.DumpType.Catchment)
            return get(`${this.getServerUrl()}/media/mobileDatabaseBackupUrl/upload`);
        else if (dumpType === MediaQueueService.DumpType.Adhoc)
            return get(`${this.getServerUrl()}/media/uploadUrl/${fileName}`);
    }

    getUploadUrl(mediaQueueItem) {
        return this.getUploadUrlForFile(mediaQueueItem.fileName);
    }

    getUploadUrlForFile(file) {
        return get(`${this.getServerUrl()}/media/uploadUrl/${file}`, false, false);
    }

    mediaExists(mediaQueueItem) {
        return fs.exists(this.getAbsoluteFileName(mediaQueueItem));
    }

    uploadToUrl(url, mediaQueueItem) {
        General.logDebug("MediaQueueService", `Uploading media to ${url}`);
        const contentType = mime.lookup(mediaQueueItem.fileName);
        const uploadTask = RNFetchBlob
            .fetch('PUT', url, {
                "Content-Type": contentType,
            }, RNFetchBlob.wrap(this.getAbsoluteFileName(mediaQueueItem)));

        let jobTimeoutHandler = this.cancelUploadIfNoProgress(new Date(), uploadTask, mediaQueueItem.fileName)
        uploadTask
            .then(() => {
                General.logDebug('MediaQueueService', `Upload of ${mediaQueueItem.uuid} - ${mediaQueueItem.fileName} done`);
            })
            .finally(() => clearTimeout(jobTimeoutHandler));

        uploadTask.uploadProgress({interval: 1000},(sent, total) => {
            General.logDebug('MediaQueueService', `${mediaQueueItem.fileName} uploadProgress ${sent}/${total}`);
            clearTimeout(jobTimeoutHandler);
            jobTimeoutHandler = this.cancelUploadIfNoProgress(new Date(), uploadTask, mediaQueueItem.fileName);
        });
        return uploadTask;
    }

    cancelUploadIfNoProgress(lastProgressTime, uploadTask, fileName) {
        const UPLOAD_PROGRESS_TIMEOUT_MS = 60000;
        return setTimeout(() => {
            General.logDebug("MediaQueueService", `Canceling upload of ${fileName}. No progress since ${lastProgressTime}`);
            uploadTask.cancel();
        }, UPLOAD_PROGRESS_TIMEOUT_MS);
    }

    foregroundUpload(url, fullFilePath, cb) {
        General.logDebug("MediaQueueService", `foreground uploading ${fullFilePath} to ${url}`);
        return RNFetchBlob.fetch('PUT', url, {
            "Content-Type": "application/octet-stream",
        }, RNFetchBlob.wrap(fullFilePath))
            .uploadProgress((written, total) => {
                General.logDebug("MediaQueueService", 'uploaded', written / total);
                cb(written, total);
            });
    }

    deleteFile(mediaQueueItem) {
        let absoluteFileName = this.getAbsoluteFileName(mediaQueueItem);
        General.logDebug("MediaQueueService", `Deleting media ${absoluteFileName}`);
        return fs.unlink(absoluteFileName);
    }

    replaceObservation(mediaQueueItem, url) {
        General.logDebug("MediaQueueService", `Replacing observation with value ${url}`);

        const canonicalUrl = url.substring(0, url.indexOf("?"));
        const entity = this.findByUUID(mediaQueueItem.entityUUID, mediaQueueItem.entityName).cloneForEdit();
        if (mediaQueueItem.entityTargetField === "profilePicture") {
            entity.updateProfilePicture(canonicalUrl);
        } else if (mediaQueueItem.entityTargetField === "observations") {
            entity.replaceMediaObservation(mediaQueueItem.fileName, canonicalUrl, mediaQueueItem.conceptUUID);
        }
        switch (mediaQueueItem.entityName) {
            case Individual.schema.name:
                this.getService(IndividualService).register(entity);
                break;
            case Encounter.schema.name:
                this.getService(EncounterService).saveOrUpdate(entity);
                break;
            case ProgramEncounter.schema.name:
                this.getService(ProgramEncounterService).saveOrUpdate(entity);
                break;
            case ProgramEnrolment.schema.name:
                Promise.resolve(this.getService(ProgramEnrolmentService).enrol(entity));
                break;
        }
    }

    async uploadMediaQueueItem(mediaQueueItem) {
        // Media can get deleted from the system by a user action.
        // The system should still work with missing media.
        // However, we need to find some way of highlighting this to user.
        const exists = await this.mediaExists(mediaQueueItem);
        if (!exists) {
            General.logDebug("MediaQueueService", `mediaQueueItem ${mediaQueueItem.fileName} does not exist. Ignoring...`);
            return;
        }

        let uploadUrl = "";

        return this.getUploadUrl(mediaQueueItem)
            .then((url) => {
                uploadUrl = url
            })
            .then(() => this.uploadToUrl(uploadUrl, mediaQueueItem))
            .then(() => this.replaceObservation(mediaQueueItem, uploadUrl))
            .then(() => this.popItem(mediaQueueItem))
            .catch((error) => {
                General.logError("MediaQueueService", `Error while uploading ${mediaQueueItem.uuid} - ${mediaQueueItem.fileName}`);
                General.logError("MediaQueueService", error);
                if (error.message === 'canceled') {
                    return Promise.reject(new Error("syncTimeoutError"))
                } else {
                    return Promise.reject(error);
                }
            });
    }

    isMediaUploadRequired() {
        return this.findAll().length > 0;
    }

    uploadMedia() {
        // Parallel push to S3 ensures maximal usage of existing bandwidth.
        // Return only once every media queue item upload succeeds or fails.
        const mediaQueueItems = _.map(this.findAll(), (mediaQueueItem) => mediaQueueItem.clone());
        General.logDebug("MediaQueueService", `Number of media queue items: ${mediaQueueItems.length}`);
        const chunkedMediaQueueItems = _.chunk(mediaQueueItems, 2);
        let current = Promise.resolve();
        for (const mediaQueueItemsChunk of chunkedMediaQueueItems) {
            current = current.then(() => Promise.allSettled(
                _.map(mediaQueueItemsChunk, (mediaQueueItem) => this.uploadMediaQueueItem(mediaQueueItem))
            )).then((results) => {
                if (_.some(results, result => result.status === 'rejected')) {
                    return Promise.reject(new Error("Media queue error"));
                } else {
                    return Promise.resolve();
                }
            });
        }
        return current;
    }
}

export default MediaQueueService;
